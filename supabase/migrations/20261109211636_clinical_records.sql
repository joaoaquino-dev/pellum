-- Additive clinical core. Apply to an isolated environment first; never replay old migrations.
begin;

create table public.aura_clinical_access (
 clinic_id uuid not null references public.aura_clinics(id) on delete restrict,
 patient_id text not null check (patient_id ~ '^[A-Za-z0-9_-]{1,80}$'),
 user_id uuid not null references auth.users(id) on delete restrict,
 professional_id integer not null check (professional_id >= 0),
 profession text not null check (profession in ('enfermagem','outra')),
 registry text not null default '' check (length(registry)<=120),
 can_write boolean not null default false, can_export boolean not null default false,
 enabled boolean not null default true,
 granted_by uuid not null references auth.users(id) on delete restrict,
 updated_at timestamptz not null default now(),
 primary key(clinic_id,patient_id,user_id)
);
create index aura_clinical_access_user_idx on public.aura_clinical_access(user_id,clinic_id);

create table public.aura_clinical_patients (
 clinic_id uuid not null references public.aura_clinics(id) on delete restrict,
 patient_id text not null check (patient_id ~ '^[A-Za-z0-9_-]{1,80}$'),
 chart_number uuid not null default gen_random_uuid() unique,
 created_at timestamptz not null default now(),
 primary key(clinic_id,patient_id)
);
create table public.aura_clinical_entries (
 id uuid primary key, clinic_id uuid not null, patient_id text not null,
 kind text not null check(kind in ('identity','anamnesis','evaluation','plan','procedure','evolution','adverse_event','consent')),
 author_id uuid not null references auth.users(id) on delete restrict,
 professional_id integer not null,
 latest_version integer not null default 0 check(latest_version>=0),
 finalized boolean not null default false,
 created_at timestamptz not null default now(),
 foreign key(clinic_id,patient_id) references public.aura_clinical_patients(clinic_id,patient_id) on delete restrict,
 unique(id,clinic_id,patient_id)
);
create index aura_clinical_entries_patient_idx on public.aura_clinical_entries(clinic_id,patient_id,created_at desc,id);
create table public.aura_clinical_versions (
 entry_id uuid not null, clinic_id uuid not null, patient_id text not null,
 version integer not null check(version>0),
 author_id uuid not null references auth.users(id) on delete restrict,
 professional_id integer not null, professional_name text not null, registry text not null,
 occurred_at timestamptz not null, recorded_at timestamptz not null default now(),
 status text not null check(status in ('draft','reviewed','addendum')),
 correction_reason text not null default '' check(length(correction_reason)<=1000),
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=65536),
 digest text not null,
 primary key(entry_id,version),
 foreign key(entry_id,clinic_id,patient_id) references public.aura_clinical_entries(id,clinic_id,patient_id) on delete restrict
);
create index aura_clinical_versions_patient_idx on public.aura_clinical_versions(clinic_id,patient_id);
create table public.aura_clinical_audit (
 id bigint generated always as identity primary key,
 clinic_id uuid not null references public.aura_clinics(id) on delete restrict,
 patient_id text not null, actor_id uuid references auth.users(id) on delete restrict,
 action text not null, entry_id uuid, created_at timestamptz not null default now()
);
create index aura_clinical_audit_patient_idx on public.aura_clinical_audit(clinic_id,patient_id,created_at desc);
create table aura_private.clinical_requests (
 actor_id uuid not null, request_id uuid not null,
 body_hash text not null, response jsonb not null, created_at timestamptz not null default now(),
 primary key(actor_id,request_id)
);
create table public.aura_clinical_templates (
 id uuid not null, clinic_id uuid not null references public.aura_clinics(id) on delete restrict,
 version integer not null check(version>0), author_id uuid not null references auth.users(id) on delete restrict,
 professional_id integer, procedure text not null default '' check(length(procedure)<=120),
 name text not null check(length(btrim(name)) between 1 and 120),
 schema jsonb not null check(jsonb_typeof(schema)='array' and jsonb_array_length(schema) between 1 and 100 and octet_length(schema::text)<=30000),
 created_at timestamptz not null default now(), primary key(id,version)
);
create index aura_clinical_templates_clinic_idx on public.aura_clinical_templates(clinic_id,id,version desc);

create function aura_private.clinical_access(p_clinic uuid,p_patient text,p_permission text default 'read')
returns boolean language sql stable security definer set search_path='' as $$
 select aura_private.can_access(p_clinic,false) and exists(
  select 1 from public.aura_clinical_access a join public.aura_clinics c on c.id=a.clinic_id
  where a.clinic_id=p_clinic and a.patient_id=p_patient and a.user_id=(select auth.uid()) and a.enabled
  and jsonb_typeof(c.data->'names')='array' and a.professional_id<jsonb_array_length(c.data->'names')
  and not coalesce(c.data->'inactivePros','[]'::jsonb) @> jsonb_build_array(a.professional_id)
  and (p_permission='read' or (p_permission='write' and a.can_write) or (p_permission='export' and a.can_export))
 );
$$;
revoke all on function aura_private.clinical_access(uuid,text,text) from public,anon;
grant execute on function aura_private.clinical_access(uuid,text,text) to authenticated;

alter table public.aura_clinical_access enable row level security;
alter table public.aura_clinical_patients enable row level security;
alter table public.aura_clinical_entries enable row level security;
alter table public.aura_clinical_versions enable row level security;
alter table public.aura_clinical_audit enable row level security;
alter table aura_private.clinical_requests enable row level security;
alter table public.aura_clinical_templates enable row level security;
revoke all on public.aura_clinical_access,public.aura_clinical_patients,public.aura_clinical_entries,
 public.aura_clinical_versions,public.aura_clinical_audit,public.aura_clinical_templates,aura_private.clinical_requests from public,anon,authenticated;
create policy clinical_access_read on public.aura_clinical_access for select to authenticated using(user_id=(select auth.uid()) and aura_private.clinical_access(clinic_id,patient_id));
create policy clinical_patients_read on public.aura_clinical_patients for select to authenticated using(aura_private.clinical_access(clinic_id,patient_id));
create policy clinical_entries_read on public.aura_clinical_entries for select to authenticated using(aura_private.clinical_access(clinic_id,patient_id));
create policy clinical_versions_read on public.aura_clinical_versions for select to authenticated using(aura_private.clinical_access(clinic_id,patient_id));
-- Audit and request data are deliberately accessible only inside authorized functions.

create function aura_private.clinical_immutable() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Registro clínico imutável' using errcode='42501'; end;
$$;
revoke all on function aura_private.clinical_immutable() from public,anon,authenticated;
create trigger clinical_versions_immutable before update or delete on public.aura_clinical_versions for each row execute function aura_private.clinical_immutable();
create trigger clinical_audit_immutable before update or delete on public.aura_clinical_audit for each row execute function aura_private.clinical_immutable();
create trigger clinical_templates_immutable before update or delete on public.aura_clinical_templates for each row execute function aura_private.clinical_immutable();

-- A legacy restore/save must not erase the identity referenced by a clinical chart.
create function aura_private.clinical_preserve_patients() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.aura_clinical_patients p where p.clinic_id=old.id and not exists(
  select 1 from jsonb_array_elements(new.data->'patients') j where j->>'id'=p.patient_id
 )) then raise exception 'Restauração removeria paciente com prontuário. Preserve os identificadores clínicos.' using errcode='23503'; end if;
 return new;
end;
$$;
revoke all on function aura_private.clinical_preserve_patients() from public,anon,authenticated;
create trigger clinical_preserve_patients before update of data on public.aura_clinics for each row execute function aura_private.clinical_preserve_patients();

-- Re-adding a member must not silently revive an old clinical grant.
create function aura_private.clinical_revoke_membership() returns trigger language plpgsql security definer set search_path='' as $$
declare a record;
begin
 for a in update public.aura_clinical_access ca set enabled=false,updated_at=now()
  where ca.clinic_id=old.clinic_id and ca.enabled and ca.user_id in(select u.id from auth.users u where lower(u.email)=old.email)
  returning ca.patient_id loop
  insert into public.aura_clinical_audit(clinic_id,patient_id,actor_id,action) values(old.clinic_id,a.patient_id,auth.uid(),'membership_revoked');
 end loop;
 return old;
end;
$$;
revoke all on function aura_private.clinical_revoke_membership() from public,anon,authenticated;
create trigger clinical_revoke_membership after delete on public.aura_members for each row execute function aura_private.clinical_revoke_membership();

create function aura_private.clinical_validate_questions(questions jsonb,answers jsonb,review boolean)
returns void language plpgsql set search_path='' as $$
declare q jsonb; v jsonb; option_value jsonb; seen text[]='{}'; visible boolean;
begin
 if jsonb_typeof(questions) is distinct from 'array' or jsonb_array_length(questions) not between 1 and 100 or jsonb_typeof(answers) is distinct from 'object' then raise exception 'Questionário inválido' using errcode='22023'; end if;
 for q in select * from jsonb_array_elements(questions) loop
  if jsonb_typeof(q) is distinct from 'object' or coalesce(q->>'id','') !~ '^[A-Za-z][A-Za-z0-9_]{0,39}$' or q->>'id'=any(seen)
   or q->>'id' in ('constructor','prototype','__proto__') or length(btrim(coalesce(q->>'label',''))) not between 1 and 300
   or coalesce(q->>'type','') not in ('tri','text','number','date','single','multi') then raise exception 'Pergunta inválida' using errcode='22023'; end if;
  if q ? 'when' and (not coalesce(q->'when'->>'field'=any(seen),false) or jsonb_typeof(q->'when'->'equals') is distinct from 'string') then raise exception 'Condição inválida' using errcode='22023'; end if;
  visible=not q ? 'when' or coalesce(answers->>(q->'when'->>'field')=q->'when'->>'equals',false);
  seen=array_append(seen,q->>'id');v=answers->(q->>'id');
  if q->>'type' in ('single','multi') then
   if jsonb_typeof(q->'options') is distinct from 'array' or jsonb_array_length(q->'options') not between 1 and 30 then raise exception 'Opções inválidas' using errcode='22023'; end if;
   for option_value in select * from jsonb_array_elements(q->'options') loop
    if jsonb_typeof(option_value) is distinct from 'string' or length(btrim(option_value#>>'{}')) not between 1 and 200 then raise exception 'Opção inválida' using errcode='22023'; end if;
   end loop;
  end if;
  if not visible then
   if v is not null then raise exception 'Resposta em campo não pertinente' using errcode='22023'; end if;
   continue;
  end if;
  if v is null or v='null'::jsonb or v='""'::jsonb or v='[]'::jsonb then
   if review and coalesce((q->>'required')::boolean,false) then raise exception 'Resposta obrigatória ausente' using errcode='22023'; end if;continue;
  end if;
  if (q->>'type'='tri' and (jsonb_typeof(v)<>'string' or v#>>'{}' not in ('yes','no','unknown')))
   or (q->>'type'='text' and (jsonb_typeof(v)<>'string' or length(v#>>'{}')>4000))
   or (q->>'type'='number' and jsonb_typeof(v)<>'number')
   or (q->>'type'='single' and not (q->'options') @> jsonb_build_array(v))
   or (q->>'type'='multi' and (jsonb_typeof(v)<>'array' or not (q->'options') @> v)) then raise exception 'Resposta inválida' using errcode='22023'; end if;
  if q->>'type'='date' then
   if jsonb_typeof(v)<>'string' or (v#>>'{}') !~ '^\d{4}-\d{2}-\d{2}$' or ((v#>>'{}')::date)::text<>v#>>'{}' then raise exception 'Data inválida' using errcode='22023'; end if;
  end if;
 end loop;
 if exists(select 1 from jsonb_object_keys(answers) a where not a=any(seen)) then raise exception 'Resposta sem pergunta correspondente' using errcode='22023'; end if;
end;
$$;
revoke all on function aura_private.clinical_validate_questions(jsonb,jsonb,boolean) from public,anon,authenticated;

create function aura_private.clinical_rpc(p_action text,p_clinic uuid,p_patient text,p_body jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
<<clinical>>
declare
 actor uuid; clinic public.aura_clinics; access_row public.aura_clinical_access;
 entry public.aura_clinical_entries; prior public.aura_clinical_versions;
 req aura_private.clinical_requests; request_id uuid; body_hash text;
 result jsonb; payload jsonb; entry_id uuid; revision integer; kind text; status text;
 at_time timestamptz; target uuid; pro integer; reason text; financial jsonb; j jsonb;
begin
 actor=auth.uid();
 if actor is null or not aura_private.can_access(p_clinic,false) then raise exception 'Acesso clínico não autorizado' using errcode='42501'; end if;
 if p_patient is null or p_patient !~ '^[A-Za-z0-9_-]{1,80}$' or jsonb_typeof(p_body) is distinct from 'object' or octet_length(p_body::text)>70000 then
  raise exception 'Solicitação clínica inválida' using errcode='22023'; end if;
 perform aura_private.limit_request('clinical',120);
 -- Lock the existing clinic aggregate, serializing against membership/snapshot changes.
 select * into clinic from public.aura_clinics where id=p_clinic for update;
 if p_action in ('access','grant','resolve_member') then
  if clinic.owner_id<>actor then raise exception 'Somente o proprietário pode gerenciar acesso clínico' using errcode='42501'; end if;
 elsif not aura_private.clinical_access(p_clinic,p_patient,case when p_action in ('save','save_template') then 'write' when p_action='export' then 'export' else 'read' end) then
  raise exception 'Acesso clínico não autorizado' using errcode='42501';
 end if;
 if p_action='export' and coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'CLINICAL_MFA_REQUIRED' using errcode='42501'; end if;
 if p_action in ('grant','save','save_template') then
  request_id=(p_body->>'requestId')::uuid;
  if request_id is null then raise exception 'Identificador da solicitação obrigatório' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text||request_id::text,0));
  body_hash=encode(sha256(convert_to(jsonb_build_array(p_action,p_clinic,p_patient,p_body)::text,'UTF8')),'hex');
  select * into req from aura_private.clinical_requests where actor_id=actor and clinical_requests.request_id=clinical.request_id;
  if found then
   if req.body_hash<>body_hash then raise exception 'Identificador reutilizado com outro conteúdo' using errcode='22023'; end if;
   return req.response;
  end if;
 end if;
 if p_action='resolve_member' then
  select to_jsonb(u.id) into result from auth.users u join public.aura_members m on m.email=lower(u.email) and m.clinic_id=p_clinic where lower(u.email)=lower(btrim(p_body->>'email')) and u.email_confirmed_at is not null;
  if result is null then raise exception 'Conta vinculada não encontrada' using errcode='22023'; end if;
 elsif p_action='access' then
  select coalesce(jsonb_agg(jsonb_build_object('userId',a.user_id,'email',u.email,'professionalId',a.professional_id,'profession',a.profession,'registry',a.registry,'write',a.can_write,'export',a.can_export,'enabled',a.enabled)),'[]') into result
   from public.aura_clinical_access a join auth.users u on u.id=a.user_id where a.clinic_id=p_clinic and a.patient_id=p_patient;
 elsif p_action='grant' then
  target=(p_body->>'userId')::uuid; pro=(p_body->>'professionalId')::integer;
  if target is null or pro is null or pro<0 or pro>=jsonb_array_length(clinic.data->'names') or coalesce(clinic.data->'inactivePros','[]'::jsonb) @> jsonb_build_array(pro)
   or not exists(select 1 from auth.users u join public.aura_members m on m.email=lower(u.email) and m.clinic_id=p_clinic where u.id=target and u.email_confirmed_at is not null)
   or not exists(select 1 from jsonb_array_elements(clinic.data->'patients') p where p->>'id'=p_patient)
   or coalesce(p_body->>'profession','') not in ('enfermagem','outra') then raise exception 'Vínculo clínico inválido' using errcode='22023'; end if;
  insert into public.aura_clinical_access(clinic_id,patient_id,user_id,professional_id,profession,registry,can_write,can_export,enabled,granted_by)
  values(p_clinic,p_patient,target,pro,p_body->>'profession',coalesce(p_body->>'registry',''),coalesce((p_body->>'write')::boolean,false),coalesce((p_body->>'export')::boolean,false),coalesce((p_body->>'enabled')::boolean,true),actor)
  on conflict(clinic_id,patient_id,user_id) do update set professional_id=excluded.professional_id,profession=excluded.profession,registry=excluded.registry,can_write=excluded.can_write,can_export=excluded.can_export,enabled=excluded.enabled,granted_by=actor,updated_at=now();
  result=jsonb_build_object('ok',true);
 elsif p_action='templates' then
  select coalesce(jsonb_agg(to_jsonb(t)),'[]') into result from (
   select distinct on (id) * from public.aura_clinical_templates where clinic_id=p_clinic
   order by id,version desc
  ) t where (t.professional_id is null or t.professional_id=(select a.professional_id from public.aura_clinical_access a where a.clinic_id=p_clinic and a.patient_id=p_patient and a.user_id=actor));
 elsif p_action='save_template' then
  entry_id=(p_body->>'id')::uuid; revision=(p_body->>'version')::integer;
  if p_body->>'professionalId' is not null and (p_body->>'professionalId')::integer<>(select a.professional_id from public.aura_clinical_access a where a.clinic_id=p_clinic and a.patient_id=p_patient and a.user_id=actor) then raise exception 'Escopo profissional do modelo não autorizado' using errcode='42501'; end if;
  if entry_id is null or revision is null or revision<0 or jsonb_typeof(p_body->'schema') is distinct from 'array' or jsonb_array_length(p_body->'schema') not between 1 and 100 then raise exception 'Modelo inválido' using errcode='22023'; end if;
  if exists(select 1 from public.aura_clinical_templates t where t.id=entry_id and (t.clinic_id<>p_clinic or t.author_id<>actor)) then raise exception 'Modelo não autorizado' using errcode='42501'; end if;
  perform aura_private.clinical_validate_questions(p_body->'schema','{}',false);
  if coalesce((select max(t.version) from public.aura_clinical_templates t where t.id=entry_id),0)<>revision then raise exception 'CLINICAL_CONFLICT' using errcode='40001'; end if;
  for j in select * from jsonb_array_elements(p_body->'schema') loop
   if jsonb_typeof(j) is distinct from 'object' or coalesce(j->>'id','') !~ '^[A-Za-z][A-Za-z0-9_]{0,39}$'
    or length(btrim(coalesce(j->>'label',''))) not between 1 and 300
    or coalesce(j->>'type','') not in ('tri','text','date','number','single','multi')
    or (j->>'type' in ('single','multi') and (jsonb_typeof(j->'options') is distinct from 'array' or jsonb_array_length(j->'options') not between 1 and 30)) then raise exception 'Pergunta inválida' using errcode='22023'; end if;
  end loop;
  if (select count(distinct q->>'id') from jsonb_array_elements(p_body->'schema') q)<>jsonb_array_length(p_body->'schema') then raise exception 'Perguntas duplicadas' using errcode='22023'; end if;
  insert into public.aura_clinical_templates(id,clinic_id,version,author_id,professional_id,procedure,name,schema)
   values(entry_id,p_clinic,revision+1,actor,(p_body->>'professionalId')::integer,coalesce(p_body->>'procedure',''),p_body->>'name',p_body->'schema');
  result=jsonb_build_object('id',entry_id,'version',revision+1);
 elsif p_action='open' then
  select to_jsonb(a) into payload from public.aura_clinical_access a where a.clinic_id=p_clinic and a.patient_id=p_patient and a.user_id=actor;
  select jsonb_build_object('chart',to_jsonb(p),'access',payload) into result from public.aura_clinical_patients p where p.clinic_id=p_clinic and p.patient_id=p_patient;
  result=coalesce(result,jsonb_build_object('chart',null,'access',payload));
  -- Summary must not depend on which 100 timeline entries the client loaded.
  select coalesce(jsonb_agg(x.item),'[]') into payload from (
   select distinct on (e.kind) e.kind,
    jsonb_build_object('kind',e.kind,'status',v.status,'recordedAt',v.recorded_at,'payload',v.payload) item
   from public.aura_clinical_entries e join public.aura_clinical_versions v on v.entry_id=e.id and v.version=e.latest_version
   where e.clinic_id=p_clinic and e.patient_id=p_patient
    and (e.kind='identity' or (e.kind='anamnesis' and v.status<>'draft'))
   order by e.kind,v.recorded_at desc,e.id desc
  ) x;
  result=result||jsonb_build_object('summary',payload);
 elsif p_action in ('list','export') then
  select coalesce(jsonb_agg(x.item order by x.created_at desc,x.id desc),'[]') into result from (
   select jsonb_build_object('id',e.id,'kind',e.kind,'version',v.version,'status',v.status,'finalized',e.finalized,'authorId',e.author_id,'professionalName',v.professional_name,'registry',v.registry,'occurredAt',v.occurred_at,'recordedAt',v.recorded_at,'createdAt',e.created_at,'reason',v.correction_reason,'payload',v.payload,'digest',v.digest) item,e.created_at,e.id
   from public.aura_clinical_entries e join public.aura_clinical_versions v on v.entry_id=e.id and v.version=e.latest_version
   where e.clinic_id=p_clinic and e.patient_id=p_patient
   and (coalesce(p_body->>'before','')='' or (e.created_at,e.id)<((p_body->>'before')::timestamptz,(p_body->>'beforeId')::uuid))
   order by e.created_at desc,e.id desc limit 100
  ) x;
  if p_action='export' then
   -- Export all versions, bounded to prevent silent partial exports.
   if (select count(*)>5000 or coalesce(sum(octet_length(v.payload::text)),0)>5242880 from public.aura_clinical_versions v where v.clinic_id=p_clinic and v.patient_id=p_patient) then raise exception 'Exportação requer processamento assistido' using errcode='54000'; end if;
   select jsonb_build_object('chart',to_jsonb(p),'patient',(select jsonb_build_object('id',pt->>'id','name',pt->>'name','phone',pt->>'phone') from jsonb_array_elements(clinic.data->'patients') pt where pt->>'id'=p_patient),'exportedAt',now(),
    'entries',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at,e.id) from public.aura_clinical_entries e where e.clinic_id=p_clinic and e.patient_id=p_patient),'[]'),
    'versions',coalesce((select jsonb_agg(to_jsonb(v) order by v.recorded_at,v.entry_id,v.version) from public.aura_clinical_versions v where v.clinic_id=p_clinic and v.patient_id=p_patient),'[]')) into result
    from public.aura_clinical_patients p where p.clinic_id=p_clinic and p.patient_id=p_patient;
  end if;
 elsif p_action='history' then
  entry_id=(p_body->>'id')::uuid;
  select coalesce(jsonb_agg(to_jsonb(v) order by v.version),'[]') into result from public.aura_clinical_versions v where v.entry_id=clinical.entry_id and v.clinic_id=p_clinic and v.patient_id=p_patient;
 elsif p_action='save' then
  select * into access_row from public.aura_clinical_access a where a.clinic_id=p_clinic and a.patient_id=p_patient and a.user_id=actor;
  entry_id=(p_body->>'id')::uuid; revision=(p_body->>'version')::integer; kind=p_body->>'kind';
  payload=p_body->'payload'; status=p_body->>'status'; reason=btrim(coalesce(p_body->>'reason',''));
  at_time=(p_body->>'occurredAt')::timestamptz;
  if entry_id is null or revision is null or revision<0 or kind is null or kind not in ('identity','anamnesis','evaluation','plan','procedure','evolution','adverse_event','consent')
   or status is null or status not in ('draft','reviewed','addendum') or jsonb_typeof(payload) is distinct from 'object' or octet_length(payload::text)>65536
   or at_time is null or at_time>now()+interval '5 minutes' or length(reason)>1000 then raise exception 'Registro clínico inválido' using errcode='22023'; end if;
  if payload ?| array['signature','signed','signedAt','signatureProvider'] then raise exception 'Assinatura clínica ainda não habilitada' using errcode='22023'; end if;
  if payload ? 'nursing' and access_row.profession<>'enfermagem' then raise exception 'Etapas de enfermagem exigem vínculo da categoria' using errcode='42501'; end if;
  if exists(select 1 from jsonb_each(payload) f where f.key not in ('questions','answers','materials','imagePurposes','nursing','templateVersion') and (jsonb_typeof(f.value)<>'string' or length(f.value#>>'{}')>4000))
   or (payload ? 'templateVersion' and jsonb_typeof(payload->'templateVersion')<>'number')
   or (payload ?| array['questions','answers','templateId','templateVersion'] and kind<>'anamnesis')
   or (payload ? 'answers' and not payload ? 'questions') then raise exception 'Formato dos campos clínicos inválido' using errcode='22023'; end if;
  if payload ? 'nursing' then
   if kind<>'evaluation' or jsonb_typeof(payload->'nursing') is distinct from 'array' then raise exception 'Etapas de enfermagem inválidas' using errcode='22023'; end if;
   if jsonb_array_length(payload->'nursing')<>5 or exists(select 1 from jsonb_array_elements(payload->'nursing') n where jsonb_typeof(n)<>'string' or length(n#>>'{}')>4000) then raise exception 'Etapas de enfermagem inválidas' using errcode='22023'; end if;
  end if;
  if payload ? 'imagePurposes' then
   if kind<>'consent' or jsonb_typeof(payload->'imagePurposes') is distinct from 'array' then raise exception 'Finalidades de imagem inválidas' using errcode='22023'; end if;
   if jsonb_array_length(payload->'imagePurposes')>4 or exists(select 1 from jsonb_array_elements(payload->'imagePurposes') p where jsonb_typeof(p)<>'string' or p#>>'{}' not in ('Redes sociais','Site institucional','Materiais publicitários','Materiais educativos')) then raise exception 'Finalidades de imagem inválidas' using errcode='22023'; end if;
  end if;
  for j in select value from jsonb_each(payload) where key in ('birthDate','firstVisit','returnDate') and value<>'""'::jsonb loop
   if j#>>'{}' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Data clínica inválida' using errcode='22023'; end if;
   perform (j#>>'{}')::date;
  end loop;
  if coalesce(payload->>'birthDate','')<>'' and (payload->>'birthDate')::date>current_date then raise exception 'Data de nascimento futura' using errcode='22023'; end if;
  if kind='anamnesis' and payload ? 'questions' then
   if payload ? 'templateId' then
    select t.schema into j from public.aura_clinical_templates t where t.id=(payload->>'templateId')::uuid and t.version=(payload->>'templateVersion')::integer and t.clinic_id=p_clinic and (t.professional_id is null or t.professional_id=access_row.professional_id);
    if j is null then raise exception 'Modelo não autorizado' using errcode='42501'; end if;
    payload=jsonb_set(payload,'{questions}',j);
   end if;
   perform aura_private.clinical_validate_questions(payload->'questions',coalesce(payload->'answers','{}'),status<>'draft');
  end if;
  if status<>'draft' and length(btrim(coalesce(payload->>'summary','')))=0 then raise exception 'Resumo obrigatório para revisão' using errcode='22023'; end if;
  if not exists(select 1 from jsonb_array_elements(clinic.data->'patients') p where p->>'id'=p_patient) then raise exception 'Paciente não encontrado nesta clínica' using errcode='22023'; end if;
  if coalesce(payload->>'appointmentId','')<>'' and not exists(select 1 from jsonb_array_elements(clinic.data->'appointments') a where a->>'id'=payload->>'appointmentId' and a->>'patient'=p_patient) then raise exception 'Agendamento não pertence à paciente' using errcode='22023'; end if;
  if coalesce(payload->>'planId','')<>'' and not exists(select 1 from public.aura_clinical_entries e where e.id=(payload->>'planId')::uuid and e.clinic_id=p_clinic and e.patient_id=p_patient and e.kind='plan') then raise exception 'Plano não pertence à paciente' using errcode='22023'; end if;
  select * into entry from public.aura_clinical_entries e where e.id=entry_id for update;
  if entry.id is not null and (entry.clinic_id<>p_clinic or entry.patient_id<>p_patient or entry.author_id<>actor or entry.kind<>kind) then raise exception 'Registro não autorizado' using errcode='42501'; end if;
  if entry.finalized then select * into prior from public.aura_clinical_versions v where v.entry_id=entry.id and v.version=entry.latest_version; end if;
  -- Client-provided material snapshots are never trusted.
  payload=payload-'materials';
  if entry.finalized and payload->>'financialRecordId' is not distinct from prior.payload->>'financialRecordId' then
   if prior.payload ? 'materials' then payload=payload||jsonb_build_object('materials',prior.payload->'materials'); end if;
  elsif coalesce(payload->>'financialRecordId','')<>'' then
   select r into financial from jsonb_array_elements(clinic.data->'records') r where r->>'id'=payload->>'financialRecordId' and r->>'patient'=p_patient;
   if financial is null then raise exception 'Atendimento não pertence à paciente' using errcode='22023'; end if;
   if exists(select 1 from jsonb_array_elements(coalesce(financial->'materials','[]')) m where not exists(select 1 from jsonb_array_elements(clinic.data->'products') pr where pr->>'id'=m->>'id')) then raise exception 'Material histórico requer conferência assistida' using errcode='22023'; end if;
   select coalesce(jsonb_agg(jsonb_build_object('id',m->>'id','name',pr->>'name','lot',pr->>'lot','expiry',pr->>'expiry','qty',m->'qty','unit',pr->>'unit','cost',m->'cost','owner',m->'owner')),'[]') into j from jsonb_array_elements(coalesce(financial->'materials','[]')) m join jsonb_array_elements(clinic.data->'products') pr on pr->>'id'=m->>'id';
   payload=payload||jsonb_build_object('materials',j);
  end if;
  if entry.id is not null then
   if entry.clinic_id<>p_clinic or entry.patient_id<>p_patient or entry.author_id<>actor or entry.kind<>kind then raise exception 'Registro não autorizado' using errcode='42501'; end if;
   if entry.latest_version<>revision then raise exception 'CLINICAL_CONFLICT' using errcode='40001'; end if;
   if entry.finalized and (status<>'addendum' or length(reason)<5) then raise exception 'Correção exige adendo e justificativa' using errcode='22023'; end if;
   if not entry.finalized and status='addendum' then raise exception 'Finalize a revisão antes do adendo' using errcode='22023'; end if;
   select * into prior from public.aura_clinical_versions v where v.entry_id=entry.id and v.version=entry.latest_version;
   -- Once recorded, procedure lot snapshots remain historical even if finance is later edited.
   if entry.finalized then
    if payload->>'financialRecordId' is distinct from prior.payload->>'financialRecordId' then raise exception 'Rastreabilidade histórica não pode ser substituída' using errcode='22023'; end if;
    if prior.payload ? 'materials' then payload=payload||jsonb_build_object('materials',prior.payload->'materials'); end if;
   end if;
  else
   if revision<>0 or status='addendum' then raise exception 'Versão inicial inválida' using errcode='40001'; end if;
   insert into public.aura_clinical_patients(clinic_id,patient_id) values(p_clinic,p_patient) on conflict do nothing;
   insert into public.aura_clinical_entries(id,clinic_id,patient_id,kind,author_id,professional_id) values(entry_id,p_clinic,p_patient,kind,actor,access_row.professional_id);
  end if;
  revision=revision+1;
  insert into public.aura_clinical_versions(entry_id,clinic_id,patient_id,version,author_id,professional_id,professional_name,registry,occurred_at,status,correction_reason,payload,digest)
  values(entry_id,p_clinic,p_patient,revision,actor,access_row.professional_id,clinic.data->'names'->>access_row.professional_id,access_row.registry,at_time,status,reason,payload,encode(sha256(convert_to(jsonb_build_array(entry_id,revision,actor,at_time,status,reason,payload)::text,'UTF8')),'hex'));
  update public.aura_clinical_entries set latest_version=revision,finalized=(status<>'draft') where id=entry_id;
  result=jsonb_build_object('id',entry_id,'version',revision,'status',status);
 else raise exception 'Ação clínica inválida' using errcode='22023';
 end if;
 insert into public.aura_clinical_audit(clinic_id,patient_id,actor_id,action,entry_id) values(p_clinic,p_patient,actor,p_action,entry_id);
 if p_action in ('grant','save','save_template') then insert into aura_private.clinical_requests(actor_id,request_id,body_hash,response) values(actor,request_id,body_hash,result); end if;
 return result;
end;
$$;
revoke all on function aura_private.clinical_rpc(text,uuid,text,jsonb) from public,anon;
grant execute on function aura_private.clinical_rpc(text,uuid,text,jsonb) to authenticated;
create function public.aura_clinical_rpc(p_action text,p_clinic uuid,p_patient text,p_body jsonb default '{}')
returns jsonb language sql security invoker set search_path='' as $$
 select aura_private.clinical_rpc(p_action,p_clinic,p_patient,p_body);
$$;
revoke all on function public.aura_clinical_rpc(text,uuid,text,jsonb) from public,anon;
grant execute on function public.aura_clinical_rpc(text,uuid,text,jsonb) to authenticated;
commit;
