-- RASCUNHO: não aplicar. Precisa de teste, revisão e migração nova pelo CLI.
-- Stop snapshot growth without silently deleting retained patient data.
alter table public.aura_clinics add column history_bytes bigint not null default 0 check(history_bytes>=0);
update public.aura_clinics c set history_bytes=(select coalesce(sum(octet_length(h.data::text)),0) from public.aura_history h where h.clinic_id=c.id);
create table aura_private.history_budget(singleton boolean primary key default true check(singleton),used_bytes bigint not null default 0 check(used_bytes>=0),limit_bytes bigint not null default 200000000 check(limit_bytes>0));
alter table aura_private.history_budget enable row level security;
revoke all on aura_private.history_budget from public,anon,authenticated;
insert into aura_private.history_budget(singleton,used_bytes) select true,coalesce(sum(history_bytes),0) from public.aura_clinics;
create function aura_private.guard_history_budget() returns trigger language plpgsql security definer set search_path='' as $$
declare bytes bigint;clinic_bytes bigint;total_bytes bigint;maximum bigint;
begin
 if tg_op='INSERT' then
  bytes=octet_length(new.data::text);
  select history_bytes into clinic_bytes from public.aura_clinics where id=new.clinic_id for update;
  select used_bytes,limit_bytes into total_bytes,maximum from aura_private.history_budget where singleton for update;
  if clinic_bytes+bytes>20000000 or total_bytes+bytes>maximum then raise exception 'Limite de armazenamento do histórico atingido. Solicite revisão de retenção e backup ao administrador.' using errcode='54000';end if;
  update public.aura_clinics set history_bytes=history_bytes+bytes where id=new.clinic_id;
  update aura_private.history_budget set used_bytes=used_bytes+bytes where singleton;return new;
 else
  bytes=octet_length(old.data::text);update public.aura_clinics set history_bytes=greatest(0,history_bytes-bytes) where id=old.clinic_id;
  update aura_private.history_budget set used_bytes=greatest(0,used_bytes-bytes) where singleton;return old;
 end if;
end$$;
revoke all on function aura_private.guard_history_budget() from public,anon,authenticated;
create trigger aura_history_budget_insert before insert on public.aura_history for each row execute function aura_private.guard_history_budget();
create trigger aura_history_budget_delete after delete on public.aura_history for each row execute function aura_private.guard_history_budget();

create or replace function aura_private.rpc_core(p_action text,p_clinic uuid,p_body jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid := auth.uid(); v_email text; v_list jsonb; v_clinic public.aura_clinics%rowtype; v_id uuid; v_owner boolean; v_data jsonb; v_revision bigint; v_member text;
begin
 if v_uid is null then raise exception 'Entre na sua conta Aura' using errcode='42501';end if;
 select lower(email) into v_email from auth.users where id=v_uid and email_confirmed_at is not null and not coalesce(is_anonymous,false);
 if v_email is null then raise exception 'Confirme seu e-mail antes de continuar' using errcode='42501';end if;
 if p_action='create' then
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text,0));
  if (select count(*) from public.aura_clinics where owner_id=v_uid)>=(select max_clinics from aura_private.licenses where email=v_email) then raise exception 'Limite de clínicas por conta atingido';end if;
  v_data=jsonb_build_object('names',jsonb_build_array('Profissional 1','Profissional 2'),'percent',70,'patients','[]'::jsonb,'appointments','[]'::jsonb,'records','[]'::jsonb,'products','[]'::jsonb,'expenses','[]'::jsonb);
  insert into public.aura_clinics(owner_id,name,data) values(v_uid,trim(p_body->>'name'),v_data) returning id into v_id;
  insert into public.aura_members(clinic_id,email,role) values(v_id,v_email,'manager');return jsonb_build_object('id',v_id);
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'role','manager') order by c.updated_at desc),'[]'::jsonb) into v_list from public.aura_clinics c where aura_private.can_access(c.id,false);
 if p_clinic is null or not aura_private.can_access(p_clinic,false) then
  if p_action='get' then p_clinic=(v_list->0->>'id')::uuid;else raise exception 'Clínica não autorizada' using errcode='42501';end if;
 end if;
 if p_clinic is null then return jsonb_build_object('user',v_email,'clinics',v_list,'data',null);end if;
 select * into v_clinic from public.aura_clinics where id=p_clinic for update;
 v_owner=aura_private.can_access(p_clinic,false);
 if p_action='get' then return jsonb_build_object('user',v_email,'clinics',v_list,'clinic',jsonb_build_object('id',v_clinic.id,'name',v_clinic.name,'role','manager'),'data',v_clinic.data,'revision',v_clinic.revision,'members',case when v_owner then (select coalesce(jsonb_agg(jsonb_build_object('email',m.email,'role',m.role)),'[]'::jsonb) from public.aura_members m where m.clinic_id=p_clinic) else '[]'::jsonb end);end if;
 if p_action='member' then
  if not v_owner then raise exception 'Somente a responsável gerencia acessos' using errcode='42501';end if;
  v_member=lower(trim(p_body->>'email'));
  if v_member is null or v_member !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or v_member=v_email then raise exception 'Informe o e-mail da outra profissional';end if;
  if not coalesce((p_body->>'remove')::boolean,false) and not aura_private.is_licensed(v_member) then raise exception 'A profissional precisa de autorização de uso da Aura' using errcode='42501';end if;
  if coalesce((p_body->>'remove')::boolean,false) then delete from public.aura_members where clinic_id=p_clinic and email=v_member and role in ('owner','editor','manager');else insert into public.aura_members(clinic_id,email,role) values(p_clinic,v_member,'manager') on conflict do nothing;end if;
  return jsonb_build_object('ok',true);
 end if;
 if p_action='history' then return jsonb_build_object('history',(select coalesce(jsonb_agg(x.v),'[]'::jsonb) from (select jsonb_build_object('id',h.id,'actor',h.actor,'date',h.created_at,'action',h.action,'revision',h.revision) v from public.aura_history h where h.clinic_id=p_clinic order by h.revision desc,h.created_at desc limit 50) x));end if;
 v_revision=(p_body->>'revision')::bigint;
 if v_revision is null or v_revision<>v_clinic.revision then raise exception 'Outra pessoa atualizou a clínica. Exporte sua cópia e recarregue.' using errcode='40001';end if;
 if p_action='restore' then
  if not v_owner then raise exception 'Somente a responsável restaura backups' using errcode='42501';end if;
  select h.data into v_data from public.aura_history h where h.id=(p_body->>'backup')::uuid and h.clinic_id=p_clinic;
  if v_data is null then raise exception 'Backup não encontrado';end if;
 elsif p_action='save' then v_data=p_body->'data';else raise exception 'Operação inválida';end if;
 if v_data is null or jsonb_typeof(v_data)<>'object' or jsonb_typeof(v_data->'patients') is distinct from 'array' or jsonb_typeof(v_data->'records') is distinct from 'array' or jsonb_typeof(v_data->'appointments') is distinct from 'array' or jsonb_typeof(v_data->'names') is distinct from 'array' or jsonb_array_length(v_data->'names')<>2 or octet_length(v_data::text)>3000000 then raise exception 'Dados inválidos ou limite de tamanho excedido';end if;
 if v_data=v_clinic.data then return jsonb_build_object('revision',v_clinic.revision);end if;
 insert into public.aura_history(clinic_id,actor,action,data,revision) values(p_clinic,v_email,case when p_action='restore' then 'Restauração de backup' else left(coalesce(p_body->>'label','Atualização de registros'),120) end,v_clinic.data,v_clinic.revision);
 update public.aura_clinics set data=v_data,revision=revision+1,updated_at=now() where id=p_clinic;
 return jsonb_build_object('revision',v_clinic.revision+1);
end;
$$;
