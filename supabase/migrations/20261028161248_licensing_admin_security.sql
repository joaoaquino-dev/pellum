create table aura_private.platform_admins(email text primary key check(email=lower(trim(email))),enabled boolean not null default true);
create table aura_private.licenses(email text primary key check(email=lower(trim(email))),status text not null default 'pending' check(status in ('pending','active','suspended')),expires_at timestamptz,max_clinics integer not null default 3 check(max_clinics between 1 and 20),revoked_before timestamptz not null default '-infinity',updated_at timestamptz not null default now());
create table aura_private.platform_audit(id uuid primary key default gen_random_uuid(),actor_id uuid not null,action text not null,target text,created_at timestamptz not null default now(),details jsonb not null default '{}');
create index aura_platform_audit_date on aura_private.platform_audit(created_at desc);
create table aura_private.request_results(user_id uuid not null,request_id uuid not null,body_hash text not null,response jsonb not null,created_at timestamptz not null default now(),primary key(user_id,request_id));
create table aura_private.rate_limits(user_id uuid not null,bucket text not null,window_start timestamptz not null,n integer not null,primary key(user_id,bucket));
alter table aura_private.platform_admins enable row level security;
alter table aura_private.licenses enable row level security;
alter table aura_private.platform_audit enable row level security;
alter table aura_private.request_results enable row level security;
alter table aura_private.rate_limits enable row level security;
revoke all on all tables in schema aura_private from public,anon,authenticated;
create function aura_private.identity() returns table(user_id uuid,email text,session_created timestamptz) language sql stable security definer set search_path='' as $$
 select u.id,lower(u.email),s.created_at from auth.users u join auth.sessions s on s.user_id=u.id and s.id=(nullif(auth.jwt()->>'session_id',''))::uuid
 where u.id=(select auth.uid()) and u.email_confirmed_at is not null and not u.is_anonymous and (u.banned_until is null or u.banned_until<now()) and (s.not_after is null or s.not_after>now()) and s.created_at is not null and s.created_at>=coalesce((select l.revoked_before from aura_private.licenses l where l.email=lower(u.email)),'-infinity');
$$;
create function aura_private.is_admin() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from aura_private.identity() u join aura_private.platform_admins a on a.email=u.email and a.enabled);$$;
create function aura_private.is_licensed(p_email text) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from aura_private.licenses l where l.email=p_email and l.status='active' and (l.expires_at is null or l.expires_at>now()));$$;
create function aura_private.account_active() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from aura_private.identity() u join aura_private.licenses l on l.email=u.email where l.status='active' and (l.expires_at is null or l.expires_at>now()) and u.session_created>=l.revoked_before and (not exists(select 1 from auth.mfa_factors f where f.user_id=u.user_id and f.status='verified') or auth.jwt()->>'aal'='aal2'));
$$;
create or replace function aura_private.can_access(p_clinic uuid,p_owner boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select aura_private.account_active() and exists(select 1 from aura_private.identity() u join public.aura_members m on m.email=u.email where m.clinic_id=p_clinic);
$$;
create function aura_private.limit_request(p_bucket text,p_limit integer) returns void language plpgsql security definer set search_path='' as $$declare n integer;begin
 insert into aura_private.rate_limits(user_id,bucket,window_start,n) values(auth.uid(),p_bucket,date_trunc('minute',now()),1) on conflict(user_id,bucket) do update set window_start=excluded.window_start,n=case when aura_private.rate_limits.window_start=excluded.window_start then aura_private.rate_limits.n+1 else 1 end returning rate_limits.n into n;
 if n>p_limit then raise exception 'Limite temporário de requisições atingido' using errcode='54000';end if;
end$$;
revoke all on function aura_private.identity(),aura_private.is_admin(),aura_private.is_licensed(text),aura_private.account_active(),aura_private.limit_request(text,integer) from public,anon,authenticated;

create unique index aura_history_revision on public.aura_history(clinic_id,revision);
alter table public.aura_members drop constraint aura_members_role_check;
alter table public.aura_members add constraint aura_members_role_check check(role in ('owner','editor','manager'));
create function aura_private.rpc_core(p_action text,p_clinic uuid,p_body jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
 insert into public.aura_history(clinic_id,actor,action,data,revision) values(p_clinic,v_email,case when p_action='restore' then 'Restauração de backup' else left(coalesce(p_body->>'label','Atualização de registros'),120) end,v_clinic.data,v_clinic.revision);
 update public.aura_clinics set data=v_data,revision=revision+1,updated_at=now() where id=p_clinic;
 return jsonb_build_object('revision',v_clinic.revision+1);
end;
$$;
revoke all on function aura_private.rpc_core(text,uuid,jsonb) from public,anon,authenticated;

create function aura_private.valid_date(v text) returns boolean language plpgsql immutable set search_path='' as $$begin return coalesce(v ~ '^\d{4}-\d{2}-\d{2}$' and v::date::text=v,false);exception when others then return false;end$$;
create function aura_private.valid_number(v jsonb,lo numeric,hi numeric,places integer) returns boolean language sql immutable set search_path='' as $$select case when jsonb_typeof(v)='number' then (v::text)::numeric between lo and hi and round((v::text)::numeric,places)=(v::text)::numeric else false end$$;
create function aura_private.assert_state(d jsonb,old_d jsonb default '{}'::jsonb) returns void language plpgsql set search_path='' as $$
#variable_conflict use_column
declare col text;j jsonb;prev jsonb;p jsonb;m jsonb;e jsonb;v numeric;s numeric;t numeric;a numeric;f numeric;recipient numeric;costs numeric;n integer;i integer;oldlist jsonb;newlist jsonb;
begin
 if d is null or jsonb_typeof(d)<>'object' or octet_length(d::text)>3000000 or exists(select 1 from jsonb_object_keys(d) k where k not in ('names','percent','patients','appointments','records','products','expenses')) then raise exception 'Estado inválido' using errcode='22023';end if;
 if jsonb_typeof(d->'names') is distinct from 'array' or jsonb_array_length(d->'names')<>2 or exists(select 1 from jsonb_array_elements(d->'names') x where jsonb_typeof(x)<>'string' or length(trim(x#>>'{}')) not between 1 and 60) or not aura_private.valid_number(d->'percent',0,100,2) then raise exception 'Configuração inválida' using errcode='22023';end if;
 foreach col in array array['patients','appointments','records','products','expenses'] loop
  if jsonb_typeof(d->col) is distinct from 'array' or jsonb_array_length(d->col)>5000 then raise exception 'Coleção inválida ou limite excedido' using errcode='22023';end if;
  if exists(select 1 from jsonb_array_elements(d->col) x where jsonb_typeof(x)<>'object' or jsonb_typeof(x->'id') is distinct from 'string' or (x->>'id') !~ '^[A-Za-z0-9_-]{1,80}$') or exists(select 1 from jsonb_array_elements(d->col) x group by x->>'id' having count(*)>1) then raise exception 'Identificador inválido ou duplicado' using errcode='22023';end if;
  if exists(select 1 from jsonb_array_elements(coalesce(old_d->col,'[]')) x where not exists(select 1 from jsonb_array_elements(d->col) y where y->>'id'=x->>'id')) then raise exception 'Use exclusão recuperável; registros anteriores não podem desaparecer' using errcode='22023';end if;
 end loop;
 for j in select * from jsonb_array_elements(d->'patients') loop
  if jsonb_typeof(j->'name') is distinct from 'string' or length(trim(j->>'name')) not between 1 and 100 or length(coalesce(j->>'phone',''))>40 or length(coalesce(j->>'note',''))>500 or (j ? 'deleted' and jsonb_typeof(j->'deleted')<>'boolean') then raise exception 'Paciente inválida' using errcode='22023';end if;
 end loop;
 for j in select * from jsonb_array_elements(d->'appointments') loop
  if not aura_private.valid_date(j->>'date') or coalesce(j->>'time','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or not aura_private.valid_number(j->'duration',15,480,0) or not aura_private.valid_number(j->'pro',0,1,0) or coalesce(j->>'status','') not in ('Agendado','Confirmado','Atendido','Cancelado','Faltou') or length(coalesce(j->>'procedure','')) not between 1 and 120 or not exists(select 1 from jsonb_array_elements(d->'patients') x where x->>'id'=j->>'patient') then raise exception 'Agendamento inválido' using errcode='22023';end if;
  if extract(epoch from (j->>'time')::time)/60+(j->>'duration')::int>1440 then raise exception 'Duração ultrapassa o dia' using errcode='22023';end if;
  if coalesce(j->>'returnOf','')<>'' and not exists(select 1 from jsonb_array_elements(d->'appointments') x where x->>'id'=j->>'returnOf' and x->>'patient'=j->>'patient' and coalesce(x->>'returnOf','')='' and x->>'id'<>j->>'id') then raise exception 'Retorno inválido' using errcode='22023';end if;
  if not exists(select 1 from jsonb_array_elements(coalesce(old_d->'appointments','[]')) x where x->>'id'=j->>'id') and exists(select 1 from jsonb_array_elements(d->'patients') x where x->>'id'=j->>'patient' and coalesce((x->>'deleted')::boolean,false)) then raise exception 'Paciente excluída não recebe novo agendamento' using errcode='22023';end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(d->'appointments') x join jsonb_array_elements(d->'appointments') y on x->>'id'<y->>'id' and x->>'date'=y->>'date' and x->>'pro'=y->>'pro' where not coalesce((x->>'deleted')::boolean,false) and not coalesce((y->>'deleted')::boolean,false) and x->>'status' not in ('Cancelado','Faltou') and y->>'status' not in ('Cancelado','Faltou') and extract(epoch from (x->>'time')::time)<extract(epoch from (y->>'time')::time)+(y->>'duration')::int*60 and extract(epoch from (y->>'time')::time)<extract(epoch from (x->>'time')::time)+(x->>'duration')::int*60) then raise exception 'Conflito de agendamentos' using errcode='22023';end if;
 for j in select * from jsonb_array_elements(d->'products') loop
  if length(coalesce(j->>'name','')) not between 1 and 100 or not aura_private.valid_number(j->'price',0,100000000,2) or not aura_private.valid_number(j->'quantity',0.001,1000000,3) or not aura_private.valid_number(coalesce(j->'packCount','1'),1,10000,0) or not aura_private.valid_number(j->'balance',0,1000000000,3) or not aura_private.valid_number(j->'owner',0,1,0) or not aura_private.valid_number(j->'minimum',0,1000000000,3) or length(coalesce(j->>'unit','')) not between 1 and 30 or length(coalesce(j->>'lot',''))>100 or (coalesce(j->>'expiry','')<>'' and not aura_private.valid_date(j->>'expiry')) or jsonb_typeof(j->'movements') is distinct from 'array' or jsonb_array_length(j->'movements')>10000 then raise exception 'Produto ou insumo inválido' using errcode='22023';end if;
  select x into prev from jsonb_array_elements(coalesce(old_d->'products','[]')) x where x->>'id'=j->>'id';
  if prev is not null and (prev->'price'<>j->'price' or prev->'quantity'<>j->'quantity' or prev->'owner'<>j->'owner' or coalesce(prev->'packCount','1')<>coalesce(j->'packCount','1') or coalesce(prev->'lot','""')<>coalesce(j->'lot','""') or coalesce(prev->'expiry','""')<>coalesce(j->'expiry','""')) then raise exception 'Custo do lote é histórico: cadastre outro lote' using errcode='22023';end if;
  oldlist=coalesce(prev->'movements','[]');newlist=j->'movements';if jsonb_array_length(oldlist)>jsonb_array_length(newlist) then raise exception 'Histórico de estoque não pode ser removido' using errcode='22023';end if;
  if jsonb_array_length(oldlist)>0 then for i in 0..jsonb_array_length(oldlist)-1 loop if oldlist->i is distinct from newlist->i then raise exception 'Histórico de estoque é imutável' using errcode='22023';end if;end loop;end if;
  s=0;for m in select * from jsonb_array_elements(newlist) loop
   if (coalesce(m->>'id','')) !~ '^[A-Za-z0-9_-]{1,80}$' or not aura_private.valid_number(m->'qty',-1000000,1000000,3) or (m->>'qty')::numeric=0 or not aura_private.valid_date(m->>'date') or coalesce(m->>'type','') not in ('entry','loss','consumption') or length(coalesce(m->>'reason',''))>500 then raise exception 'Movimento de estoque inválido' using errcode='22023';end if;
   if (m->>'type'='entry' and (m->>'qty')::numeric<0) or (m->>'type' in ('loss','consumption') and (m->>'qty')::numeric>0) then raise exception 'Sinal do movimento inválido' using errcode='22023';end if;
   if m->>'type'='consumption' and not exists(select 1 from jsonb_array_elements(d->'records') r cross join jsonb_array_elements(coalesce(r->'materials','[]')) x where r->>'id'=m->>'recordId' and x->>'mid'=m->>'materialId' and x->>'id'=j->>'id' and (x->>'qty')::numeric=-(m->>'qty')::numeric) then raise exception 'Consumo sem atendimento correspondente' using errcode='22023';end if;
   s=s+(m->>'qty')::numeric;
  end loop;
  if (j->>'balance')::numeric<>(j->>'quantity')::numeric*coalesce((j->>'packCount')::numeric,1)+s then raise exception 'Saldo de estoque não confere com o histórico' using errcode='22023';end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(d->'products') p cross join jsonb_array_elements(p->'movements') x group by x->>'id' having count(*)>1) then raise exception 'Movimento duplicado' using errcode='22023';end if;
 for j in select * from jsonb_array_elements(d->'records') loop
  if not aura_private.valid_date(j->>'date') or length(coalesce(j->>'procedure','')) not between 1 and 120 or not exists(select 1 from jsonb_array_elements(d->'patients') p where p->>'id'=j->>'patient') then raise exception 'Atendimento inválido' using errcode='22023';end if;
  if not exists(select 1 from jsonb_array_elements(coalesce(old_d->'records','[]')) x where x->>'id'=j->>'id') and exists(select 1 from jsonb_array_elements(d->'patients') x where x->>'id'=j->>'patient' and coalesce((x->>'deleted')::boolean,false)) then raise exception 'Paciente excluída não recebe novo atendimento' using errcode='22023';end if;
  foreach col in array array['price','discount','cost1','cost2','received','initialReceived','transferred'] loop if not aura_private.valid_number(j->col,0,100000000,2) then raise exception 'Valor financeiro inválido' using errcode='22023';end if;end loop;
  if not aura_private.valid_number(j->'percent',0,100,2) or not aura_private.valid_number(j->'fee',0,100,2) or coalesce(j->>'feeOwner','') not in ('0','1','split') or not aura_private.valid_number(j->'collector',0,1,0) or not aura_private.valid_number(j->'installments',1,36,0) or not aura_private.valid_date(j->>'due') or jsonb_typeof(j->'materials') is distinct from 'array' or jsonb_typeof(j->'payments') is distinct from 'array' or jsonb_array_length(j->'materials')>100 or jsonb_array_length(j->'payments')>500 or coalesce(j->>'mode','gross') not in ('gross','reimburse') then raise exception 'Divisão ou pagamento inválido' using errcode='22023';end if;
  t=(j->>'price')::numeric-(j->>'discount')::numeric;
  if t<0 or (j->>'received')::numeric>t or (j->>'initialReceived')::numeric>(j->>'received')::numeric or jsonb_typeof(j->'paid') is distinct from 'boolean' or (j->>'paid')::boolean<>((j->>'received')::numeric=t) then raise exception 'Pagamento não confere com a venda' using errcode='22023';end if;
  if jsonb_typeof(j->'schedule') is distinct from 'array' or jsonb_array_length(j->'schedule')<>(case when (j->>'received')::numeric=t then 0 else (j->>'installments')::int end) then raise exception 'Parcelamento inválido' using errcode='22023';end if;
  s=0;i=0;for e in select * from jsonb_array_elements(j->'schedule') loop
   if not aura_private.valid_number(e->'value',0,100000000,2) or not aura_private.valid_date(e->>'date') or (e->>'date')::date<>((j->>'due')::date+make_interval(months=>i))::date then raise exception 'Parcela inválida' using errcode='22023';end if;s=s+(e->>'value')::numeric;i=i+1;
  end loop;if s<>t-(j->>'received')::numeric then raise exception 'Parcelas não conferem com o saldo' using errcode='22023';end if;
  if coalesce(j->>'parent','')<>'' and not exists(select 1 from jsonb_array_elements(d->'records') r where r->>'id'=j->>'parent' and r->>'patient'=j->>'patient' and coalesce(r->>'parent','')='' and r->>'id'<>j->>'id') then raise exception 'Vínculo de retorno inválido' using errcode='22023';end if;
  select x into prev from jsonb_array_elements(coalesce(old_d->'records','[]')) x where x->>'id'=j->>'id';
  if prev is not null and (prev->'initialReceived' is distinct from j->'initialReceived' or prev->'materials' is distinct from j->'materials' or ((prev->>'transferred')::numeric>0 and prev->'collector'<>j->'collector')) then raise exception 'Lançamentos históricos não podem ser reatribuídos' using errcode='22023';end if;
  oldlist=coalesce(prev->'payments','[]');newlist=j->'payments';if jsonb_array_length(oldlist)>jsonb_array_length(newlist) then raise exception 'Pagamentos não podem ser apagados' using errcode='22023';end if;
  if jsonb_array_length(oldlist)>0 then for i in 0..jsonb_array_length(oldlist)-1 loop if oldlist->i is distinct from newlist->i then raise exception 'Pagamentos são imutáveis' using errcode='22023';end if;end loop;end if;
  s=(j->>'initialReceived')::numeric;v=0;for e in select * from jsonb_array_elements(newlist) loop
   if coalesce(e->>'id','') !~ '^[A-Za-z0-9_-]{1,80}$' or not aura_private.valid_number(e->'value',0.01,100000000,2) or not aura_private.valid_date(e->>'date') or coalesce(e->>'type','') not in ('recebimento','repasse') then raise exception 'Lançamento financeiro inválido' using errcode='22023';end if;
   if e->>'type'='recebimento' then s=s+(e->>'value')::numeric;else v=v+(e->>'value')::numeric;end if;
  end loop;
  if s<>(j->>'received')::numeric or v<>(j->>'transferred')::numeric then raise exception 'Recebimentos ou repasses não conferem com o histórico' using errcode='22023';end if;
  a=round((t-case when j->>'mode'='reimburse' then (j->>'cost1')::numeric+(j->>'cost2')::numeric else 0 end)*(j->>'percent')::numeric/100,2)+case when j->>'mode'='reimburse' then (j->>'cost1')::numeric else 0 end;
  f=round(t*(j->>'fee')::numeric/100,2);
  if j->>'collector'='0' then recipient=t-a-case when j->>'feeOwner'='1' then f when j->>'feeOwner'='split' then f-round(f*(j->>'percent')::numeric/100,2) else 0 end;
  else recipient=a-case when j->>'feeOwner'='0' then f when j->>'feeOwner'='split' then round(f*(j->>'percent')::numeric/100,2) else 0 end;end if;
  if v>greatest(0,recipient) then raise exception 'Repasse supera a parte contratual' using errcode='22023';end if;
  costs=0;for m in select * from jsonb_array_elements(j->'materials') loop
   select x into p from jsonb_array_elements(d->'products') x where x->>'id'=m->>'id';
   if p is not null and coalesce(p->>'expiry','')<>'' and (p->>'expiry')::date<(j->>'date')::date then raise exception 'Lote vencido na data do atendimento' using errcode='22023';end if;
   if p is null or coalesce(m->>'mid','') !~ '^[A-Za-z0-9_-]{1,80}$' or not aura_private.valid_number(m->'qty',0.001,1000000,3) or not aura_private.valid_number(m->'cost',0,100000000,2) or m->'owner' is distinct from p->'owner' or (m->>'cost')::numeric<>round((p->>'price')::numeric/(p->>'quantity')::numeric*(m->>'qty')::numeric,2) then raise exception 'Custo de material não confere com o lote' using errcode='22023';end if;
   if (select count(*) from jsonb_array_elements(p->'movements') x where x->>'type'='consumption' and x->>'recordId'=j->>'id' and x->>'materialId'=m->>'mid' and (x->>'qty')::numeric=-(m->>'qty')::numeric)<>1 then raise exception 'Baixa de material ausente ou duplicada' using errcode='22023';end if;
  end loop;
  for i in 0..1 loop select coalesce(sum((m->>'cost')::numeric),0) into costs from jsonb_array_elements(j->'materials') m where (m->>'owner')::int=i;if costs>(j->>case when i=0 then 'cost1' else 'cost2' end)::numeric then raise exception 'Custo declarado menor que os materiais consumidos' using errcode='22023';end if;end loop;
 end loop;
 if exists(select 1 from jsonb_array_elements(d->'records') r cross join jsonb_array_elements(r->'payments') p group by p->>'id' having count(*)>1) or exists(select 1 from jsonb_array_elements(d->'records') r cross join jsonb_array_elements(r->'materials') m group by m->>'mid' having count(*)>1) then raise exception 'Lançamento duplicado' using errcode='22023';end if;
 for j in select * from jsonb_array_elements(d->'expenses') loop if length(coalesce(j->>'name','')) not between 1 and 100 or not aura_private.valid_date(j->>'date') or not aura_private.valid_number(j->'value',0.01,100000000,2) or coalesce(j->>'owner','') not in ('0','1','shared') then raise exception 'Despesa inválida' using errcode='22023';end if;end loop;
end$$;
revoke all on function aura_private.valid_date(text),aura_private.valid_number(jsonb,numeric,numeric,integer),aura_private.assert_state(jsonb,jsonb) from public,anon,authenticated;

create or replace function aura_private.rpc(p_action text,p_clinic uuid,p_body jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u record;l aura_private.licenses%rowtype;v jsonb;old_data jsonb;old_revision bigint;rid uuid;h text;cached aura_private.request_results%rowtype;v_admin boolean;
begin
 select * into u from aura_private.identity();if u.user_id is null then raise exception 'AURA_AUTH_REQUIRED' using errcode='42501';end if;
 if jsonb_typeof(p_body)<>'object' or octet_length(p_body::text)>3000000 then raise exception 'Payload inválido' using errcode='22023';end if;
 v_admin=aura_private.is_admin();
 if p_action='get' then
  perform aura_private.limit_request('read',120);
  insert into aura_private.licenses(email) values(u.email) on conflict do nothing;
  select * into l from aura_private.licenses where email=u.email;
  if not aura_private.account_active() then return jsonb_build_object('user',u.email,'data',null,'clinics','[]'::jsonb,'is_admin',v_admin,'access',jsonb_build_object('status',case when l.status='active' and l.expires_at<=now() then 'expired' when l.status='active' and u.session_created<l.revoked_before then 'reauthenticate' when l.status='active' and exists(select 1 from auth.mfa_factors f where f.user_id=u.user_id and f.status='verified') and coalesce(auth.jwt()->>'aal','')<>'aal2' then 'mfa_required' else l.status end,'expires_at',l.expires_at));end if;
  if p_clinic is not null and not aura_private.can_access(p_clinic,false) then raise exception 'Clínica não autorizada' using errcode='42501';end if;
  v=aura_private.rpc_core(p_action,p_clinic,p_body);return v||jsonb_build_object('is_admin',v_admin,'access',jsonb_build_object('status','active','expires_at',l.expires_at));
 end if;
 if not aura_private.account_active() then raise exception 'AURA_ACCESS_DENIED' using errcode='42501';end if;
 if p_action not in ('create','save','restore','member','history','export') then raise exception 'Operação inválida' using errcode='22023';end if;
 if p_action<>'create' and (p_clinic is null or not aura_private.can_access(p_clinic,false)) then raise exception 'Clínica não autorizada' using errcode='42501';end if;
 if p_action='history' then perform aura_private.limit_request('read',120);return aura_private.rpc_core(p_action,p_clinic,p_body);end if;
 if p_action in ('member','restore') and (coalesce(auth.jwt()->>'aal','')<>'aal2' or not exists(select 1 from auth.mfa_factors f where f.user_id=u.user_id and f.status='verified')) then raise exception 'AURA_MFA_REQUIRED' using errcode='42501';end if;
 perform aura_private.limit_request('write',30);
 begin rid=(p_body->>'requestId')::uuid;exception when others then raise exception 'Identificador de requisição inválido' using errcode='22023';end;
 if rid is null then raise exception 'Identificador de requisição ausente' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(u.user_id::text||rid::text,0));
 h=encode(sha256(convert_to(jsonb_build_object('action',p_action,'clinic',p_clinic,'body',p_body)::text,'UTF8')),'hex');
 select * into cached from aura_private.request_results r where r.user_id=u.user_id and r.request_id=rid;
 if found then if cached.body_hash<>h then raise exception 'Identificador já usado com outro conteúdo' using errcode='22023';end if;return cached.response;end if;
 if p_action in ('save','restore') then
  select data,revision into old_data,old_revision from public.aura_clinics where id=p_clinic for update;
  if (p_body->>'revision')::bigint is distinct from old_revision then raise exception 'Outra profissional alterou a clínica. Exporte sua cópia e recarregue.' using errcode='40001';end if;
  if p_action='save' then perform aura_private.assert_state(p_body->'data',old_data);else
   select data into old_data from public.aura_history where clinic_id=p_clinic and id=(p_body->>'backup')::uuid;
   if old_data is null then raise exception 'Backup não encontrado' using errcode='22023';end if;perform aura_private.assert_state(old_data,'{}');
  end if;
 end if;
 if p_action='export' then v=jsonb_build_object('ok',true);else v=aura_private.rpc_core(p_action,p_clinic,p_body);end if;
 insert into aura_private.request_results(user_id,request_id,body_hash,response) values(u.user_id,rid,h,v);
 insert into aura_private.platform_audit(actor_id,action,target,details) values(u.user_id,'clinic.'||p_action,p_clinic::text,jsonb_build_object('request_id',rid,'revision',v->'revision'));
 return v;
end$$;
create function aura_private.admin_rpc(p_action text,p_body jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare u record;t text;l aura_private.licenses%rowtype;st text;v jsonb;lim integer;exp timestamptz;
begin
 select * into u from aura_private.identity();
 if u.user_id is null or not aura_private.is_admin() then raise exception 'Administrador não autorizado' using errcode='42501';end if;
 if coalesce(auth.jwt()->>'aal','')<>'aal2' or not exists(select 1 from auth.mfa_factors f where f.user_id=u.user_id and f.status='verified') then raise exception 'AURA_MFA_REQUIRED' using errcode='42501';end if;
 if jsonb_typeof(p_body)<>'object' or octet_length(p_body::text)>5000 then raise exception 'Payload inválido' using errcode='22023';end if;
 perform aura_private.limit_request('admin',30);
 if p_action='list' then return jsonb_build_object('licenses',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select email,status,expires_at,max_clinics,updated_at from aura_private.licenses order by updated_at desc limit 200) x),'audit',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select action,target,created_at from aura_private.platform_audit where action like 'admin.%' order by created_at desc limit 50) x));end if;
 if p_action not in ('authorize','suspend','revoke_sessions') then raise exception 'Operação administrativa inválida' using errcode='22023';end if;
 t=lower(trim(p_body->>'email'));if t is null or length(t)>254 or t !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'E-mail inválido' using errcode='22023';end if;
 select * into l from aura_private.licenses where email=t for update;
 if p_action='authorize' then
  lim=coalesce((p_body->>'max_clinics')::int,3);if lim not between 1 and 20 then raise exception 'Limite inválido' using errcode='22023';end if;
  exp=nullif(p_body->>'expires_at','')::timestamptz;if exp is not null and exp<=now() then raise exception 'Validade precisa ser futura' using errcode='22023';end if;
  insert into aura_private.licenses(email,status,expires_at,max_clinics) values(t,'active',exp,lim) on conflict(email) do update set status='active',expires_at=excluded.expires_at,max_clinics=excluded.max_clinics,updated_at=now();
 elsif p_action='suspend' then insert into aura_private.licenses(email,status,revoked_before) values(t,'suspended',now()) on conflict(email) do update set status='suspended',revoked_before=now(),updated_at=now();
 else update aura_private.licenses set revoked_before=now(),updated_at=now() where email=t;if not found then raise exception 'Conta não encontrada' using errcode='22023';end if;
 end if;
 insert into aura_private.platform_audit(actor_id,action,target,details) values(u.user_id,'admin.'||p_action,t,jsonb_build_object('previous_status',l.status,'limit',lim));return jsonb_build_object('ok',true);
end$$;
revoke all on function aura_private.admin_rpc(text,jsonb) from public,anon;
grant execute on function aura_private.admin_rpc(text,jsonb) to authenticated;
create function public.aura_admin_rpc(p_action text,p_body jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select aura_private.admin_rpc(p_action,p_body);$$;
revoke all on function public.aura_admin_rpc(text,jsonb) from public,anon;
grant execute on function public.aura_admin_rpc(text,jsonb) to authenticated;
-- No platform administrator is bootstrapped from browser input or user_metadata.
