begin;
-- Preserve the category at record time. Do not infer a historical category from
-- a later access grant. Existing versions stay unknown; use the stricter profile.
alter table public.aura_clinical_versions add column professional_category text check(professional_category in ('enfermagem','outra'));
create function aura_private.clinical_record_category() returns trigger language plpgsql security definer set search_path='' as $$
begin
 select a.profession into new.professional_category from public.aura_clinical_access a
  where a.clinic_id=new.clinic_id and a.patient_id=new.patient_id and a.user_id=new.author_id and a.enabled;
 if new.professional_category is null then raise exception 'Clinical professional category unavailable' using errcode='42501'; end if;
 return new;
end;$$;
revoke all on function aura_private.clinical_record_category() from public,anon,authenticated;
create trigger clinical_record_category before insert on public.aura_clinical_versions for each row execute function aura_private.clinical_record_category();
-- Prepared source packages are not signed documents. No provider is selected.
create table public.aura_clinical_documents (
 id uuid primary key, clinic_id uuid not null, patient_id text not null,
 prepared_by uuid not null references auth.users(id) on delete restrict,
 kind text not null check(kind in ('professional_record','procedure_consent','clinical_photo_consent','advertising_consent')),
 source_entry_id uuid not null, source_version integer not null,
 source_snapshot jsonb not null, source_digest text not null,
 required_signature text not null check(required_signature in ('qualified','advanced_or_qualified','legal_review_required')),
 created_at timestamptz not null default now(),
 foreign key(source_entry_id,source_version) references public.aura_clinical_versions(entry_id,version) on delete restrict,
 foreign key(clinic_id,patient_id) references public.aura_clinical_patients(clinic_id,patient_id) on delete restrict
);
create index aura_clinical_documents_patient_idx on public.aura_clinical_documents(clinic_id,patient_id,created_at desc,id);
create table public.aura_clinical_document_events (
 id bigint generated always as identity primary key,
 document_id uuid not null references public.aura_clinical_documents(id) on delete restrict,
 actor_id uuid references auth.users(id) on delete restrict,
 provider text not null, provider_event_id text not null, event_hash text not null,
 event_type text not null, state_after text not null check(state_after in ('prepared','dispatch_requested','provider_created','received_unverified','verified','refused','expired','cancelled','validation_failed')),
 prepared_sha256 text, signed_sha256 text, evidence_sha256 text,
 created_at timestamptz not null default now(),
 unique(provider,provider_event_id)
);
create index aura_clinical_document_events_doc_idx on public.aura_clinical_document_events(document_id,id desc);
create table aura_private.clinical_signature_envelopes (
 document_id uuid primary key references public.aura_clinical_documents(id) on delete restrict,
 provider text not null, envelope_id text not null,
 prepared_sha256 text not null, unique(provider,envelope_id)
);
alter table aura_private.clinical_signature_envelopes enable row level security;
revoke all on aura_private.clinical_signature_envelopes from public,anon,authenticated;
create trigger clinical_signature_envelopes_immutable before update or delete on aura_private.clinical_signature_envelopes for each row execute function aura_private.clinical_immutable();
alter table public.aura_clinical_documents enable row level security;
alter table public.aura_clinical_document_events enable row level security;
revoke all on public.aura_clinical_documents,public.aura_clinical_document_events from public,anon,authenticated;
create policy clinical_documents_read on public.aura_clinical_documents for select to authenticated using(aura_private.clinical_access(clinic_id,patient_id));
create trigger clinical_documents_immutable before update or delete on public.aura_clinical_documents for each row execute function aura_private.clinical_immutable();
create trigger clinical_document_events_immutable before update or delete on public.aura_clinical_document_events for each row execute function aura_private.clinical_immutable();

create function aura_private.clinical_document_rpc(p_action text,p_clinic uuid,p_patient text,p_body jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.aura_clinical_documents; v public.aura_clinical_versions; e public.aura_clinical_entries;
 a public.aura_clinical_access; target uuid; kind text; result jsonb;
begin
 if not aura_private.clinical_access(p_clinic,p_patient,case when p_action='prepare' then 'write' when p_action='export' then 'export' else 'read' end) then raise exception 'Document access denied' using errcode='42501'; end if;
 if jsonb_typeof(p_body) is distinct from 'object' or octet_length(p_body::text)>4000 then raise exception 'Invalid document request' using errcode='22023'; end if;
 perform aura_private.limit_request('clinical_document',60);
 if p_action='list' then
  select coalesce(jsonb_agg(x.item order by x.created_at desc,x.id desc),'[]') into result from (
   select jsonb_build_object('id',cd.id,'kind',cd.kind,'sourceEntryId',cd.source_entry_id,'sourceVersion',cd.source_version,'requiredSignature',cd.required_signature,'createdAt',cd.created_at,
    'state',(select de.state_after from public.aura_clinical_document_events de where de.document_id=cd.id order by de.id desc limit 1)) item,cd.created_at,cd.id
   from public.aura_clinical_documents cd where clinic_id=p_clinic and patient_id=p_patient
    and (coalesce(p_body->>'before','')='' or (cd.created_at,cd.id)<((p_body->>'before')::timestamptz,(p_body->>'beforeId')::uuid))
   order by cd.created_at desc,cd.id desc limit 50
  ) x;
 elsif p_action='prepare' then
  target=(p_body->>'id')::uuid;kind=p_body->>'kind';
  if target is null or coalesce(kind,'') not in ('professional_record','procedure_consent','clinical_photo_consent','advertising_consent') then raise exception 'Invalid document kind' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(target::text,2));
  select * into d from public.aura_clinical_documents where id=target;
  if d.id is not null then
   if d.clinic_id<>p_clinic or d.patient_id<>p_patient or d.prepared_by<>auth.uid() or d.kind<>kind or d.source_entry_id is distinct from (p_body->>'entryId')::uuid or d.source_version is distinct from (p_body->>'version')::integer then raise exception 'Document request changed' using errcode='22023'; end if;
  else
   select * into e from public.aura_clinical_entries where id=(p_body->>'entryId')::uuid and clinic_id=p_clinic and patient_id=p_patient;
   select * into v from public.aura_clinical_versions where entry_id=e.id and version=(p_body->>'version')::integer;
   if e.id is null or v.entry_id is null or e.author_id<>auth.uid() or v.status='draft' then raise exception 'Reviewed source by responsible professional required' using errcode='42501'; end if;
   if (kind='professional_record' and e.kind='consent') or (kind<>'professional_record' and (e.kind<>'consent' or v.payload->>'purpose' is distinct from case kind when 'procedure_consent' then 'Procedimento' when 'clinical_photo_consent' then 'Fotografia para cuidado' else 'Uso externo de imagem' end)) then raise exception 'Separate consent purpose required' using errcode='22023'; end if;
   select * into a from public.aura_clinical_access where clinic_id=p_clinic and patient_id=p_patient and user_id=auth.uid();
   insert into public.aura_clinical_documents(id,clinic_id,patient_id,prepared_by,kind,source_entry_id,source_version,source_snapshot,source_digest,required_signature)
    values(target,p_clinic,p_patient,auth.uid(),kind,e.id,v.version,jsonb_build_object('entryKind',e.kind,'version',to_jsonb(v)),v.digest,
     case when kind<>'professional_record' then 'legal_review_required' when v.professional_category='outra' then 'advanced_or_qualified' else 'qualified' end) returning * into d;
   insert into public.aura_clinical_document_events(document_id,actor_id,provider,provider_event_id,event_hash,event_type,state_after)
    values(target,auth.uid(),'pellum',target::text,d.source_digest,'prepared','prepared');
  end if;
  result=jsonb_build_object('id',d.id,'sourceDigest',d.source_digest,'requiredSignature',d.required_signature,'state','prepared');
 elsif p_action in ('history','export') then
  select * into d from public.aura_clinical_documents where id=(p_body->>'id')::uuid and clinic_id=p_clinic and patient_id=p_patient;
  if d.id is null then raise exception 'Document access denied' using errcode='42501'; end if;
  if p_action='export' then
   if coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'CLINICAL_MFA_REQUIRED' using errcode='42501'; end if;
   result=to_jsonb(d);
  else select coalesce(jsonb_agg(jsonb_build_object('type',event_type,'state',state_after,'createdAt',created_at,'preparedSha256',prepared_sha256,'signedSha256',signed_sha256) order by id),'[]') into result from public.aura_clinical_document_events where document_id=d.id; end if;
 else raise exception 'Invalid document action' using errcode='22023'; end if;
 insert into public.aura_clinical_audit(clinic_id,patient_id,actor_id,action) values(p_clinic,p_patient,auth.uid(),'document.'||p_action);
 return result;
end;$$;
revoke all on function aura_private.clinical_document_rpc(text,uuid,text,jsonb) from public,anon;
grant execute on function aura_private.clinical_document_rpc(text,uuid,text,jsonb) to authenticated;
create function public.aura_clinical_document_rpc(p_action text,p_clinic uuid,p_patient text,p_body jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select aura_private.clinical_document_rpc(p_action,p_clinic,p_patient,p_body)$$;
revoke all on function public.aura_clinical_document_rpc(text,uuid,text,jsonb) from public,anon;
grant execute on function public.aura_clinical_document_rpc(text,uuid,text,jsonb) to authenticated;

-- Future verified webhook adapter: no client may assert a signature. Events are
-- append-only, replay-bound and ordered by the server, not provider timestamps.
create function aura_private.clinical_document_event(p_document uuid,p_provider text,p_event_id text,p_body jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.aura_clinical_documents; prior public.aura_clinical_document_events; cached public.aura_clinical_document_events;
 body_hash text; next_state text; event_type text; prepared_hash text; bound_provider text;
begin
 if jsonb_typeof(p_body) is distinct from 'object' or octet_length(p_body::text)>5000 or p_provider !~ '^[a-z][a-z0-9_-]{1,39}$' or length(p_event_id) not between 1 and 200 then raise exception 'Invalid event' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_document::text,2));
 select * into d from public.aura_clinical_documents where id=p_document;
 if d.id is null then raise exception 'Unknown document' using errcode='22023'; end if;
 body_hash=encode(sha256(convert_to(jsonb_build_array(p_document,p_body)::text,'UTF8')),'hex');
 select * into cached from public.aura_clinical_document_events where provider=p_provider and provider_event_id=p_event_id;
 if found then
  if cached.document_id<>p_document or cached.event_hash<>body_hash then raise exception 'Event replay changed' using errcode='22023'; end if;
  return jsonb_build_object('state',cached.state_after,'replayed',true);
 end if;
 select * into prior from public.aura_clinical_document_events where document_id=p_document order by id desc limit 1;
 next_state=prior.state_after;event_type=p_body->>'type';prepared_hash=prior.prepared_sha256;
 if p_body->>'sourceDigest' is distinct from d.source_digest then raise exception 'Source digest mismatch' using errcode='22023'; end if;
 select de.provider into bound_provider from public.aura_clinical_document_events de where de.document_id=p_document and de.event_type='dispatch_requested' order by de.id limit 1;
 if bound_provider is not null and bound_provider<>p_provider then raise exception 'Provider binding mismatch' using errcode='22023'; end if;
 if bound_provider is null and event_type<>'dispatch_requested' then raise exception 'Document not dispatched' using errcode='22023'; end if;
 if prior.prepared_sha256 is not null and p_body ? 'preparedSha256' and p_body->>'preparedSha256' is distinct from prior.prepared_sha256 then raise exception 'Rendered digest changed' using errcode='22023'; end if;
 if event_type='dispatch_requested' and prior.state_after='prepared' then
  prepared_hash=p_body->>'preparedSha256';
  if coalesce(prepared_hash,'') !~ '^[a-f0-9]{64}$' or p_body->>'policyApproved' is distinct from 'true' or coalesce(p_body->>'policyVersion','')='' then raise exception 'Rendered bytes and approved policy required' using errcode='22023'; end if;next_state='dispatch_requested';
 elsif event_type='provider_created' and prior.state_after='dispatch_requested' then
  if length(coalesce(p_body->>'envelopeId','')) not between 1 and 200 then raise exception 'Envelope binding required' using errcode='22023'; end if;
  insert into aura_private.clinical_signature_envelopes(document_id,provider,envelope_id,prepared_sha256) values(p_document,p_provider,p_body->>'envelopeId',prepared_hash);
  next_state='provider_created';
 elsif event_type='provider_completed' and prior.state_after in ('dispatch_requested','provider_created') then next_state='received_unverified';
 elsif event_type in ('refused','expired','cancelled') and prior.state_after in ('dispatch_requested','provider_created') then next_state=event_type;
 elsif event_type='validation_failed' and prior.state_after='received_unverified' then next_state='validation_failed';
 elsif event_type='verified' and prior.state_after='received_unverified' then
  if p_body->>'preparedSha256' is distinct from prior.prepared_sha256 or coalesce(p_body->>'signedSha256','') !~ '^[a-f0-9]{64}$' or coalesce(p_body->>'evidenceSha256','') !~ '^[a-f0-9]{64}$'
   or p_body->>'contentMatches' is distinct from 'true' or p_body->>'allSignersVerified' is distinct from 'true'
   or (d.required_signature='qualified' and p_body->>'professionalQualified' is distinct from 'true') then raise exception 'Verified signature evidence required' using errcode='22023'; end if;
  next_state='verified';
 end if;
 -- Late/unknown events are retained without regressing a terminal state.
 insert into public.aura_clinical_document_events(document_id,provider,provider_event_id,event_hash,event_type,state_after,prepared_sha256,signed_sha256,evidence_sha256)
 values(p_document,p_provider,p_event_id,body_hash,coalesce(event_type,'unknown'),next_state,prepared_hash,
  case when next_state='verified' and prior.state_after<>'verified' then p_body->>'signedSha256' else prior.signed_sha256 end,
  case when next_state='verified' and prior.state_after<>'verified' then p_body->>'evidenceSha256' else prior.evidence_sha256 end);
 return jsonb_build_object('state',next_state,'replayed',false);
end;$$;
revoke all on function aura_private.clinical_document_event(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function aura_private.clinical_document_event(uuid,text,text,jsonb) to service_role;
create function public.aura_clinical_document_event(p_document uuid,p_provider text,p_event_id text,p_body jsonb) returns jsonb language sql security invoker set search_path='' as $$select aura_private.clinical_document_event(p_document,p_provider,p_event_id,p_body)$$;
revoke all on function public.aura_clinical_document_event(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.aura_clinical_document_event(uuid,text,text,jsonb) to service_role;
create function aura_private.clinical_document_envelope(p_provider text,p_envelope text) returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('documentId',d.id,'sourceDigest',d.source_digest,'requiredSignature',d.required_signature,'preparedSha256',e.prepared_sha256)
 from aura_private.clinical_signature_envelopes e join public.aura_clinical_documents d on d.id=e.document_id where e.provider=p_provider and e.envelope_id=p_envelope
$$;
revoke all on function aura_private.clinical_document_envelope(text,text) from public,anon,authenticated;
grant execute on function aura_private.clinical_document_envelope(text,text) to service_role;
create function public.aura_clinical_document_envelope(p_provider text,p_envelope text) returns jsonb language sql security invoker set search_path='' as $$select aura_private.clinical_document_envelope(p_provider,p_envelope)$$;
revoke all on function public.aura_clinical_document_envelope(text,text) from public,anon,authenticated;
grant execute on function public.aura_clinical_document_envelope(text,text) to service_role;
commit;
