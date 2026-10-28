do $migration$ begin if to_regclass('public.aura_clinics') is null then execute $ddl$create schema if not exists aura_private;
revoke all on schema aura_private from public, anon;
grant usage on schema aura_private to authenticated;
create table public.aura_clinics (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 name text not null check (length(trim(name)) between 1 and 100),
 data jsonb not null, revision bigint not null default 0 check(revision>=0), updated_at timestamptz not null default now()
);
create index aura_clinics_owner_idx on public.aura_clinics(owner_id);
create table public.aura_members (
 clinic_id uuid not null references public.aura_clinics(id) on delete cascade,
 email text not null check(email=lower(trim(email))),role text not null check(role in ('owner','editor')),
 primary key(clinic_id,email)
);
create index aura_members_email_idx on public.aura_members(email,clinic_id);
create table public.aura_history (
 id uuid primary key default gen_random_uuid(),clinic_id uuid not null references public.aura_clinics(id) on delete cascade,
 actor text not null,created_at timestamptz not null default now(),action text not null,data jsonb not null,revision bigint not null
);
create index aura_history_clinic_date_idx on public.aura_history(clinic_id,created_at desc);
alter table public.aura_clinics enable row level security;
alter table public.aura_members enable row level security;
alter table public.aura_history enable row level security;
create function aura_private.can_access(p_clinic uuid,p_owner boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and exists (
 select 1 from public.aura_clinics c join auth.users u on u.id=(select auth.uid())
 where c.id=p_clinic and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
 and (c.owner_id=u.id or (not p_owner and exists(select 1 from public.aura_members m where m.clinic_id=c.id and m.email=lower(u.email)))));
$$;
revoke all on function aura_private.can_access(uuid,boolean) from public,anon;
grant execute on function aura_private.can_access(uuid,boolean) to authenticated;
create policy aura_clinic_read on public.aura_clinics for select to authenticated using ((select aura_private.can_access(id,false)));
create policy aura_members_owner_read on public.aura_members for select to authenticated using ((select aura_private.can_access(clinic_id,true)));
create policy aura_history_owner_read on public.aura_history for select to authenticated using ((select aura_private.can_access(clinic_id,true)));
revoke all on public.aura_clinics,public.aura_members,public.aura_history from anon,authenticated;
grant select on public.aura_clinics,public.aura_members,public.aura_history to authenticated;
create function aura_private.rpc(p_action text,p_clinic uuid,p_body jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid := auth.uid(); v_email text; v_list jsonb; v_clinic public.aura_clinics%rowtype; v_id uuid; v_owner boolean; v_data jsonb; v_revision bigint; v_member text;
begin
 if v_uid is null then raise exception 'Entre na sua conta Aura' using errcode='42501';end if;
 select lower(email) into v_email from auth.users where id=v_uid and email_confirmed_at is not null and not coalesce(is_anonymous,false);
 if v_email is null then raise exception 'Confirme seu e-mail antes de continuar' using errcode='42501';end if;
 if p_action='create' then
  if (select count(*) from public.aura_clinics where owner_id=v_uid)>=5 then raise exception 'Limite de clínicas por conta atingido';end if;
  v_data=jsonb_build_object('names',jsonb_build_array('Profissional 1','Profissional 2'),'percent',70,'patients','[]'::jsonb,'appointments','[]'::jsonb,'records','[]'::jsonb,'products','[]'::jsonb,'expenses','[]'::jsonb);
  insert into public.aura_clinics(owner_id,name,data) values(v_uid,trim(p_body->>'name'),v_data) returning id into v_id;
  insert into public.aura_members(clinic_id,email,role) values(v_id,v_email,'owner');return jsonb_build_object('id',v_id);
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'role',case when c.owner_id=v_uid then 'owner' else 'editor' end) order by c.updated_at desc),'[]'::jsonb) into v_list from public.aura_clinics c where aura_private.can_access(c.id,false);
 if p_clinic is null or not aura_private.can_access(p_clinic,false) then
  if p_action='get' then p_clinic=(v_list->0->>'id')::uuid;else raise exception 'Clínica não autorizada' using errcode='42501';end if;
 end if;
 if p_clinic is null then return jsonb_build_object('user',v_email,'clinics',v_list,'data',null);end if;
 select * into v_clinic from public.aura_clinics where id=p_clinic for update;
 v_owner=v_clinic.owner_id=v_uid;
 if p_action='get' then return jsonb_build_object('user',v_email,'clinics',v_list,'clinic',jsonb_build_object('id',v_clinic.id,'name',v_clinic.name,'role',case when v_owner then 'owner' else 'editor' end),'data',v_clinic.data,'revision',v_clinic.revision,'members',case when v_owner then (select coalesce(jsonb_agg(jsonb_build_object('email',m.email,'role',m.role)),'[]'::jsonb) from public.aura_members m where m.clinic_id=p_clinic) else '[]'::jsonb end);end if;
 if p_action='member' then
  if not v_owner then raise exception 'Somente a responsável gerencia acessos' using errcode='42501';end if;
  v_member=lower(trim(p_body->>'email'));
  if v_member is null or v_member !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or v_member=v_email then raise exception 'Informe o e-mail da outra profissional';end if;
  if coalesce((p_body->>'remove')::boolean,false) then delete from public.aura_members where clinic_id=p_clinic and email=v_member and role='editor';else insert into public.aura_members(clinic_id,email,role) values(p_clinic,v_member,'editor') on conflict do nothing;end if;
  return jsonb_build_object('ok',true);
 end if;
 if p_action='history' then return jsonb_build_object('history',(select coalesce(jsonb_agg(x.v),'[]'::jsonb) from (select jsonb_build_object('id',h.id,'actor',h.actor,'date',h.created_at,'action',h.action,'revision',h.revision) v from public.aura_history h where h.clinic_id=p_clinic order by h.created_at desc limit 50) x));end if;
 v_revision=(p_body->>'revision')::bigint;
 if v_revision is null or v_revision<>v_clinic.revision then raise exception 'Outra pessoa atualizou a clínica. Exporte sua cópia e recarregue.' using errcode='40001';end if;
 if p_action='restore' then
  if not v_owner then raise exception 'Somente a responsável restaura backups' using errcode='42501';end if;
  select h.data into v_data from public.aura_history h where h.id=(p_body->>'backup')::uuid and h.clinic_id=p_clinic;
  if v_data is null then raise exception 'Backup não encontrado';end if;
 elsif p_action='save' then v_data=p_body->'data';else raise exception 'Operação inválida';end if;
 if v_data is null or jsonb_typeof(v_data)<>'object' or jsonb_typeof(v_data->'patients') is distinct from 'array' or jsonb_typeof(v_data->'records') is distinct from 'array' or jsonb_typeof(v_data->'appointments') is distinct from 'array' or jsonb_typeof(v_data->'names') is distinct from 'array' or jsonb_array_length(v_data->'names')<>2 or octet_length(v_data::text)>3000000 then raise exception 'Dados inválidos ou limite de tamanho excedido';end if;
 insert into public.aura_history(clinic_id,actor,action,data,revision) values(p_clinic,v_email,case when p_action='restore' then 'Restauração de backup' else left(coalesce(p_body->>'label','Atualização de registros'),120) end,v_clinic.data,v_clinic.revision);
 update public.aura_clinics set data=v_data,revision=revision+1,updated_at=now() where id=p_clinic;
 return jsonb_build_object('revision',v_clinic.revision+1);
end;
$$;
revoke all on function aura_private.rpc(text,uuid,jsonb) from public,anon;
grant execute on function aura_private.rpc(text,uuid,jsonb) to authenticated;
create function public.aura_rpc(p_action text,p_clinic uuid default null,p_body jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$ select aura_private.rpc(p_action,p_clinic,p_body); $$;
revoke all on function public.aura_rpc(text,uuid,jsonb) from public,anon;
grant execute on function public.aura_rpc(text,uuid,jsonb) to authenticated;
$ddl$; end if; end $migration$;
