begin;
create table public.aura_clinical_form_templates (
 id uuid not null,version integer not null check(version>0),
 clinic_id uuid not null references public.aura_clinics(id) on delete restrict,
 author_id uuid not null references auth.users(id) on delete restrict,
 kind text not null check(kind in ('procedure','consent')),professional_id integer,
 procedure text not null default '' check(length(procedure)<=120),
 purpose text not null default '' check(purpose in ('','Procedimento','Fotografia para cuidado','Uso externo de imagem')),
 name text not null check(length(btrim(name)) between 1 and 120),
 schema jsonb not null check(jsonb_typeof(schema)='array' and jsonb_array_length(schema) between 1 and 100),
 created_at timestamptz not null default now(),primary key(id,version)
);
create index clinical_form_templates_clinic_kind_idx on public.aura_clinical_form_templates(clinic_id,kind,id,version desc);
create table aura_private.clinical_form_template_requests (
 actor_id uuid not null references auth.users(id) on delete restrict,request_id uuid not null,
 body_hash text not null,response jsonb not null,primary key(actor_id,request_id)
);
alter table public.aura_clinical_form_templates enable row level security;
alter table aura_private.clinical_form_template_requests enable row level security;
revoke all on public.aura_clinical_form_templates,aura_private.clinical_form_template_requests from public,anon,authenticated;
create trigger clinical_form_templates_immutable before update or delete on public.aura_clinical_form_templates for each row execute function aura_private.clinical_immutable();
create trigger clinical_form_template_requests_immutable before update or delete on aura_private.clinical_form_template_requests for each row execute function aura_private.clinical_immutable();
create function aura_private.clinical_form_template_rpc(p_action text,p_clinic uuid,p_patient text,p_body jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
<<template_request>>
declare actor uuid:=auth.uid();professional integer;target uuid;revision integer;request_id uuid;hash text;
 cached aura_private.clinical_form_template_requests;result jsonb;previous public.aura_clinical_form_templates;
begin
 if actor is null or not aura_private.can_access(p_clinic,false) then raise exception 'Template access denied' using errcode='42501';end if;
 perform 1 from public.aura_clinics where id=p_clinic for update;
 if not aura_private.clinical_access(p_clinic,p_patient,case when p_action='save' then 'write' else 'read' end) then raise exception 'Template access denied' using errcode='42501';end if;
 if jsonb_typeof(p_body) is distinct from 'object' or octet_length(p_body::text)>60000 or coalesce(p_body->>'kind','') not in ('procedure','consent') then raise exception 'Invalid template' using errcode='22023';end if;
 select a.professional_id into professional from public.aura_clinical_access a where a.clinic_id=p_clinic and a.patient_id=p_patient and a.user_id=actor;
 perform aura_private.limit_request('clinical_form_templates',60);
 if p_action='list' then
  select coalesce(jsonb_agg(to_jsonb(t) order by t.name,t.id),'[]') into result from (
   select distinct on(id) * from public.aura_clinical_form_templates where clinic_id=p_clinic and kind=p_body->>'kind' order by id,version desc
  ) t where (t.professional_id is null or t.professional_id=professional)
    and (not p_body ? 'procedure' or t.procedure='' or t.procedure=p_body->>'procedure')
    and (not p_body ? 'purpose' or t.purpose=p_body->>'purpose');
  return result;
 end if;
 if p_action<>'save' then raise exception 'Invalid template action' using errcode='22023';end if;
 request_id=(p_body->>'requestId')::uuid;target=(p_body->>'id')::uuid;revision=(p_body->>'version')::integer;
 if request_id is null or target is null or revision is null or revision<0 then raise exception 'Invalid template version' using errcode='22023';end if;
 hash=encode(sha256(convert_to(jsonb_build_array(p_action,p_clinic,p_patient,p_body)::text,'UTF8')),'hex');
 select * into cached from aura_private.clinical_form_template_requests r where r.actor_id=actor and r.request_id=template_request.request_id;
 if found then if cached.body_hash<>hash then raise exception 'Request ID reused' using errcode='22023';end if;return cached.response;end if;
 if p_body->>'professionalId' is not null and (p_body->>'professionalId')::integer<>professional then raise exception 'Template professional scope denied' using errcode='42501';end if;
 select * into previous from public.aura_clinical_form_templates where id=target order by version desc limit 1;
 if found and (previous.clinic_id<>p_clinic or previous.author_id<>actor or previous.kind<>p_body->>'kind') then raise exception 'Template author denied' using errcode='42501';end if;
 if coalesce(previous.version,0)<>revision then raise exception 'CLINICAL_CONFLICT' using errcode='40001';end if;
 if p_body->>'kind'='consent' and coalesce(p_body->>'purpose','') not in ('Procedimento','Fotografia para cuidado','Uso externo de imagem') or p_body->>'kind'='procedure' and coalesce(p_body->>'purpose','')<>'' then raise exception 'Invalid template purpose' using errcode='22023';end if;
 perform aura_private.clinical_validate_questions(p_body->'schema','{}',false);
 insert into public.aura_clinical_form_templates(id,version,clinic_id,author_id,kind,professional_id,procedure,purpose,name,schema)
 values(target,revision+1,p_clinic,actor,p_body->>'kind',(p_body->>'professionalId')::integer,coalesce(p_body->>'procedure',''),coalesce(p_body->>'purpose',''),p_body->>'name',p_body->'schema');
 result=jsonb_build_object('id',target,'version',revision+1);
 insert into aura_private.clinical_form_template_requests values(actor,request_id,hash,result);
 insert into public.aura_clinical_audit(clinic_id,patient_id,actor_id,action) values(p_clinic,p_patient,actor,'form_template.save');
 return result;
end;$$;
revoke all on function aura_private.clinical_form_template_rpc(text,uuid,text,jsonb) from public,anon;
grant execute on function aura_private.clinical_form_template_rpc(text,uuid,text,jsonb) to authenticated;
create function public.aura_clinical_form_template_rpc(p_action text,p_clinic uuid,p_patient text,p_body jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select aura_private.clinical_form_template_rpc(p_action,p_clinic,p_patient,p_body)$$;
revoke all on function public.aura_clinical_form_template_rpc(text,uuid,text,jsonb) from public,anon;
grant execute on function public.aura_clinical_form_template_rpc(text,uuid,text,jsonb) to authenticated;

-- Preserve the existing clinical RPC, adding explicit native-JSON form validation.
create or replace function aura_private.clinical_rpc(p_action text,p_clinic uuid,p_patient text,p_body jsonb)
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
  if exists(select 1 from jsonb_each(payload) f where f.key not in ('questions','answers','materials','imagePurposes','nursing','templateVersion','formQuestions','formAnswers','formTemplateVersion') and (jsonb_typeof(f.value)<>'string' or length(f.value#>>'{}')>4000))
   or (payload ? 'templateVersion' and jsonb_typeof(payload->'templateVersion')<>'number')
   or (payload ?| array['questions','answers','templateId','templateVersion'] and kind<>'anamnesis')
   or (payload ? 'answers' and not payload ? 'questions') then raise exception 'Formato dos campos clínicos inválido' using errcode='22023'; end if;
  if payload ?| array['formTemplateId','formTemplateVersion','formQuestions','formAnswers','formTemplateName'] then
   if kind not in ('procedure','consent') or not payload ? 'formTemplateId' or jsonb_typeof(payload->'formTemplateVersion') is distinct from 'number' then raise exception 'Invalid form template reference' using errcode='22023';end if;
   select to_jsonb(t) into j from public.aura_clinical_form_templates t where t.id=(payload->>'formTemplateId')::uuid and t.version=(payload->>'formTemplateVersion')::integer and t.clinic_id=p_clinic and t.kind=clinical.kind and (t.professional_id is null or t.professional_id=access_row.professional_id) and (t.procedure='' or t.procedure=payload->>'procedure') and (clinical.kind<>'consent' or t.purpose=payload->>'purpose');
   if j is null then raise exception 'Form template scope denied' using errcode='42501';end if;
   perform aura_private.clinical_validate_questions(j->'schema',coalesce(payload->'formAnswers','{}'),status<>'draft');
   payload=payload||jsonb_build_object('formQuestions',j->'schema','formTemplateName',j->>'name','formAnswers',coalesce(payload->'formAnswers','{}'));
  end if;
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
    if kind in ('procedure','consent') and (payload->'formTemplateId' is distinct from prior.payload->'formTemplateId' or payload->'formTemplateVersion' is distinct from prior.payload->'formTemplateVersion') then raise exception 'Reviewed form template cannot be replaced' using errcode='22023';end if;
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

commit;
