begin;
create table public.aura_clinical_followups (
 id uuid primary key references public.aura_clinical_entries(id) on delete restrict,
 clinic_id uuid not null,patient_id text not null,source_version integer not null,
 professional_id integer not null,due_date date not null,
 status text not null check(status in ('planned','scheduled','completed','dismissed')),
 appointment_id text,revision bigint not null default 1,updated_at timestamptz not null default now(),
 foreign key(id,source_version) references public.aura_clinical_versions(entry_id,version) on delete restrict,
 foreign key(id,clinic_id,patient_id) references public.aura_clinical_entries(id,clinic_id,patient_id) on delete restrict
);
create index clinical_followups_clinic_date_idx on public.aura_clinical_followups(clinic_id,due_date,id);
create table aura_private.clinical_followup_events (
 id bigint generated always as identity primary key,followup_id uuid not null references public.aura_clinical_followups(id) on delete restrict,
 actor_id uuid not null references auth.users(id) on delete restrict,action text not null,details jsonb not null,created_at timestamptz not null default now()
);
create table aura_private.clinical_followup_requests (
 actor_id uuid not null references auth.users(id) on delete restrict,request_id uuid not null,body_hash text not null,response jsonb not null,primary key(actor_id,request_id)
);
alter table public.aura_clinical_followups enable row level security;
alter table aura_private.clinical_followup_events enable row level security;
alter table aura_private.clinical_followup_requests enable row level security;
revoke all on public.aura_clinical_followups,aura_private.clinical_followup_events,aura_private.clinical_followup_requests from public,anon,authenticated;
create trigger clinical_followup_events_immutable before update or delete on aura_private.clinical_followup_events for each row execute function aura_private.clinical_immutable();
create trigger clinical_followup_requests_immutable before update or delete on aura_private.clinical_followup_requests for each row execute function aura_private.clinical_immutable();

-- A reviewed evolution creates a forecast, never a calendar appointment or message.
create function aura_private.clinical_followup_from_version() returns trigger language plpgsql security definer set search_path='' as $$
declare entry_kind text;row public.aura_clinical_followups;expected date;has_live_appointment boolean;
begin
 select kind into entry_kind from public.aura_clinical_entries where id=new.entry_id;
 if entry_kind<>'evolution' or new.status='draft' then return new;end if;
 select * into row from public.aura_clinical_followups where id=new.entry_id;
 if found and row.status='completed' then return new;end if;
 if coalesce(new.payload->>'returnDate','')='' then
  select exists(select 1 from public.aura_clinics c cross join jsonb_array_elements(c.data->'appointments') a where c.id=new.clinic_id and a->>'id'=row.appointment_id and a->>'patient'=new.patient_id and not coalesce((a->>'deleted')::boolean,false) and a->>'status' not in ('Cancelado','Faltou')) into has_live_appointment;
  if row.id is not null and not has_live_appointment then
   update public.aura_clinical_followups set status='dismissed',revision=revision+1,updated_at=now() where id=row.id;
   insert into aura_private.clinical_followup_events(followup_id,actor_id,action,details) values(row.id,new.author_id,'date_cleared',jsonb_build_object('sourceVersion',new.version));
  end if;
  return new;
 end if;
 expected=(new.payload->>'returnDate')::date;
 if row.id is null then
  insert into public.aura_clinical_followups(id,clinic_id,patient_id,source_version,professional_id,due_date,status) values(new.entry_id,new.clinic_id,new.patient_id,new.version,new.professional_id,expected,'planned');
 elsif row.due_date=expected and row.status<>'dismissed' then return new;
 else
  update public.aura_clinical_followups set source_version=new.version,professional_id=new.professional_id,due_date=expected,status=case when status='dismissed' then 'planned' else status end,revision=revision+1,updated_at=now() where id=row.id;
 end if;
 insert into aura_private.clinical_followup_events(followup_id,actor_id,action,details) values(new.entry_id,new.author_id,'forecast',jsonb_build_object('sourceVersion',new.version,'dueDate',expected));
 return new;
end;$$;
revoke all on function aura_private.clinical_followup_from_version() from public,anon,authenticated;
create trigger clinical_followup_from_version after insert on public.aura_clinical_versions for each row execute function aura_private.clinical_followup_from_version();

-- Reuse already reviewed dates, without editing the original clinical versions.
insert into public.aura_clinical_followups(id,clinic_id,patient_id,source_version,professional_id,due_date,status)
 select e.id,e.clinic_id,e.patient_id,v.version,v.professional_id,(v.payload->>'returnDate')::date,'planned'
 from public.aura_clinical_entries e join public.aura_clinical_versions v on v.entry_id=e.id and v.version=e.latest_version
 where e.kind='evolution' and e.finalized and v.status<>'draft' and coalesce(v.payload->>'returnDate','')<>'';
insert into aura_private.clinical_followup_events(followup_id,actor_id,action,details)
 select f.id,v.author_id,'forecast_import',jsonb_build_object('sourceVersion',f.source_version,'dueDate',f.due_date)
 from public.aura_clinical_followups f join public.aura_clinical_versions v on v.entry_id=f.id and v.version=f.source_version;

create function aura_private.followup_effective_state(stored text,appointment jsonb) returns text language sql immutable set search_path='' as $$
 select case when stored in ('completed','dismissed') then stored
 when appointment is null or coalesce((appointment->>'deleted')::boolean,false) or appointment->>'status' in ('Cancelado','Faltou') then 'planned'
 when appointment->>'status'='Atendido' then 'completed' else 'scheduled' end;
$$;
revoke all on function aura_private.followup_effective_state(text,jsonb) from public,anon,authenticated;

create function aura_private.clinical_followup_rpc(p_action text,p_clinic uuid,p_patient text,p_body jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
<<followup_request>>
declare actor uuid:=auth.uid();clinic public.aura_clinics;row public.aura_clinical_followups;cached aura_private.clinical_followup_requests;
 request_id uuid;hash text;result jsonb;appointment jsonb;next_data jsonb;expected_revision bigint;pro integer;effective text;procedure_name text;
begin
 if actor is null or not aura_private.can_access(p_clinic,false) then raise exception 'Followup access denied' using errcode='42501';end if;
 if jsonb_typeof(p_body) is distinct from 'object' or octet_length(p_body::text)>5000 or (p_patient is not null and p_patient !~ '^[A-Za-z0-9_-]{1,80}$') then raise exception 'Invalid followup request' using errcode='22023';end if;
 perform aura_private.limit_request('clinical_followups',120);
 if p_action='list' then
  select * into clinic from public.aura_clinics where id=p_clinic;
  if p_patient is not null and not aura_private.clinical_access(p_clinic,p_patient,'read') then raise exception 'Followup access denied' using errcode='42501';end if;
  select coalesce(jsonb_agg(x.item order by x.due_date,x.id),'[]') into result from (
   select f.id,f.due_date,jsonb_build_object('id',f.id,'patientId',f.patient_id,'patientName',coalesce((select p->>'name' from jsonb_array_elements(clinic.data->'patients') p where p->>'id'=f.patient_id),'Paciente'),
    'professionalId',f.professional_id,'professionalName',clinic.data->'names'->f.professional_id,'dueDate',f.due_date,'revision',f.revision,'appointment',a.item,
    'state',aura_private.followup_effective_state(f.status,a.item),'canWrite',aura_private.clinical_access(p_clinic,f.patient_id,'write')) item
   from public.aura_clinical_followups f left join lateral (select app item from jsonb_array_elements(clinic.data->'appointments') app where app->>'id'=f.appointment_id and app->>'patient'=f.patient_id) a on true
   where f.clinic_id=p_clinic and (p_patient is null or f.patient_id=p_patient) and aura_private.clinical_access(p_clinic,f.patient_id,'read') and f.status<>'dismissed'
  ) x;
  return jsonb_build_object('items',result,'clinicRevision',clinic.revision,'today',(now() at time zone 'America/Sao_Paulo')::date);
 end if;
 if p_action not in ('schedule','complete','reopen') then raise exception 'Invalid followup action' using errcode='22023';end if;
 select * into clinic from public.aura_clinics where id=p_clinic for update;
 select * into row from public.aura_clinical_followups f where f.id=(p_body->>'id')::uuid and f.clinic_id=p_clinic;
 if not found or (p_patient is not null and p_patient<>row.patient_id) or not aura_private.clinical_access(p_clinic,row.patient_id,'write') then raise exception 'Followup access denied' using errcode='42501';end if;
 request_id=(p_body->>'requestId')::uuid;if request_id is null then raise exception 'Request ID required' using errcode='22023';end if;
 hash=encode(sha256(convert_to(jsonb_build_array(p_action,p_clinic,p_patient,p_body)::text,'UTF8')),'hex');
 select * into cached from aura_private.clinical_followup_requests r where r.actor_id=actor and r.request_id=followup_request.request_id;
 if found then if cached.body_hash<>hash then raise exception 'Request ID reused' using errcode='22023';end if;return cached.response;end if;
 if row.revision is distinct from (p_body->>'revision')::bigint then raise exception 'FOLLOWUP_CONFLICT' using errcode='40001';end if;
 select a into appointment from jsonb_array_elements(clinic.data->'appointments') a where a->>'id'=row.appointment_id and a->>'patient'=row.patient_id;
 effective=aura_private.followup_effective_state(row.status,appointment);
 if p_action='schedule' then
  if row.status in ('completed','dismissed') or effective='scheduled' or effective='completed' then raise exception 'FOLLOWUP_ALREADY_SCHEDULED' using errcode='22023';end if;
  if clinic.revision is distinct from (p_body->>'clinicRevision')::bigint then raise exception 'FOLLOWUP_CONFLICT' using errcode='40001';end if;
  pro=(p_body->>'professionalId')::integer;
  if pro is null or pro<0 or pro>=jsonb_array_length(clinic.data->'names') or coalesce(clinic.data->'inactivePros','[]') @> to_jsonb(pro) then raise exception 'Profissional indisponível' using errcode='22023';end if;
  procedure_name=btrim(coalesce(p_body->>'procedure',''));
  if length(procedure_name) not between 1 and 100 or not aura_private.valid_date(p_body->>'date') or coalesce(p_body->>'time','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or not aura_private.valid_number(p_body->'duration',15,480,0) or (p_body->>'duration')::integer%15<>0 then raise exception 'Confira a data, horário e duração.' using errcode='22023';end if;
  appointment=jsonb_build_object('id',gen_random_uuid()::text,'patient',row.patient_id,'pro',pro,'procedure',procedure_name,'date',p_body->>'date','time',p_body->>'time','duration',p_body->'duration','status','Agendado');
  next_data=jsonb_set(clinic.data,'{appointments}',clinic.data->'appointments'||jsonb_build_array(appointment));
  perform aura_private.assert_state(next_data,clinic.data);
  insert into public.aura_history(clinic_id,actor,action,data,revision) values(p_clinic,(select lower(email) from auth.users where id=actor),'Agendamento de retorno',clinic.data,clinic.revision);
  update public.aura_clinics set data=next_data,revision=revision+1,updated_at=now() where id=p_clinic;
  update public.aura_clinical_followups set status='scheduled',appointment_id=appointment->>'id',revision=revision+1,updated_at=now() where id=row.id;
 elsif p_action='complete' then
  update public.aura_clinical_followups set status='completed',revision=revision+1,updated_at=now() where id=row.id;
 else
  if effective<>'completed' then raise exception 'Somente um retorno concluído pode ser reaberto.' using errcode='22023';end if;
  update public.aura_clinical_followups set status=case when appointment->>'status' in ('Agendado','Confirmado') and not coalesce((appointment->>'deleted')::boolean,false) then 'scheduled' else 'planned' end,appointment_id=case when appointment->>'status' in ('Agendado','Confirmado') and not coalesce((appointment->>'deleted')::boolean,false) then row.appointment_id else null end,revision=revision+1,updated_at=now() where id=row.id;
 end if;
 select jsonb_build_object('ok',true,'id',f.id,'revision',f.revision,'appointmentId',f.appointment_id) into result from public.aura_clinical_followups f where f.id=row.id;
 insert into aura_private.clinical_followup_requests values(actor,request_id,hash,result);
 insert into aura_private.clinical_followup_events(followup_id,actor_id,action,details) values(row.id,actor,p_action,result);
 insert into public.aura_clinical_audit(clinic_id,patient_id,actor_id,action,entry_id) values(p_clinic,row.patient_id,actor,'followup.'||p_action,row.id);
 return result;
end;$$;
revoke all on function aura_private.clinical_followup_rpc(text,uuid,text,jsonb) from public,anon;
grant execute on function aura_private.clinical_followup_rpc(text,uuid,text,jsonb) to authenticated;
create function public.aura_clinical_followup_rpc(p_action text,p_clinic uuid,p_patient text default null,p_body jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select aura_private.clinical_followup_rpc(p_action,p_clinic,p_patient,p_body)$$;
revoke all on function public.aura_clinical_followup_rpc(text,uuid,text,jsonb) from public,anon;
grant execute on function public.aura_clinical_followup_rpc(text,uuid,text,jsonb) to authenticated;
commit;
