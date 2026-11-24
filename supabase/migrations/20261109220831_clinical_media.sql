-- Isolated staging first. Never apply against production during development.
begin;
grant usage on schema aura_private to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('pellum-clinical-originals','pellum-clinical-originals',false,4000000,array['image/jpeg','image/png','image/webp','application/pdf']),
 ('pellum-clinical-display','pellum-clinical-display',false,4000000,array['image/jpeg'])
on conflict(id) do nothing;
do $$begin
 if exists(select 1 from storage.buckets where id in ('pellum-clinical-originals','pellum-clinical-display') and public) then
  raise exception 'Clinical buckets must be private';
 end if;
end$$;
-- Even an unrelated permissive policy cannot expose clinical objects. Only the
-- audited backend may use these buckets. Service credentials stay server-side.
create policy pellum_clinical_gateway_only on storage.objects as restrictive
 for all to anon,authenticated
 using(bucket_id not in ('pellum-clinical-originals','pellum-clinical-display'))
 with check(bucket_id not in ('pellum-clinical-originals','pellum-clinical-display'));

create table public.aura_clinical_media (
 id uuid primary key, clinic_id uuid not null, patient_id text not null,
 uploaded_by uuid not null references auth.users(id) on delete restrict,
 professional_id integer not null, professional_name text not null, registry text not null, entry_id uuid,
 created_at timestamptz not null default now(), captured_at timestamptz not null,
 stage text not null check(stage in ('before','immediate','follow_up','attachment')),
 region text not null check(length(region)<=120), notes text not null check(length(notes)<=2000),
 clinical_basis text not null check(clinical_basis in ('consent_documented','care_basis_reviewed')),
 basis_reference text not null check(length(btrim(basis_reference)) between 5 and 500),
 processing_basis_reference text not null check(length(btrim(processing_basis_reference)) between 5 and 500),
 mime text not null check(mime in ('image/jpeg','image/png','image/webp','application/pdf')),
 original_size integer not null check(original_size between 1 and 4000000),
 original_sha256 text not null check(original_sha256 ~ '^[a-f0-9]{64}$'),
 request_hash text not null,
 state text not null default 'pending' check(state in ('pending','ready')),
 display_sha256 text check(display_sha256 ~ '^[a-f0-9]{64}$'),
 display_size integer check(display_size between 1 and 4000000),
 width integer check(width between 1 and 2048), height integer check(height between 1 and 2048),
 scan_engine text, scanned_at timestamptz, completed_at timestamptz,
 foreign key(clinic_id,patient_id) references public.aura_clinical_patients(clinic_id,patient_id) on delete restrict,
 foreign key(entry_id,clinic_id,patient_id) references public.aura_clinical_entries(id,clinic_id,patient_id) on delete restrict,
 check((mime='application/pdf')=(stage='attachment')),
 check(state<>'ready' or (scanned_at is not null and scan_engine is not null and completed_at is not null
  and (mime='application/pdf' or (display_sha256 is not null and display_size is not null and width is not null and height is not null))))
);
create index aura_clinical_media_patient_idx on public.aura_clinical_media(clinic_id,patient_id,captured_at desc,id);
create table public.aura_clinical_media_events (
 id bigint generated always as identity primary key,
 media_id uuid not null references public.aura_clinical_media(id) on delete restrict,
 actor_id uuid not null references auth.users(id) on delete restrict,
 action text not null check(action in ('reserved','ready','view','export','publicity_revoked')),
 created_at timestamptz not null default now()
);
create index aura_clinical_media_events_idx on public.aura_clinical_media_events(media_id,id);
alter table public.aura_clinical_media enable row level security;
alter table public.aura_clinical_media_events enable row level security;
revoke all on public.aura_clinical_media,public.aura_clinical_media_events from public,anon,authenticated;
create policy clinical_media_read on public.aura_clinical_media for select to authenticated
 using(aura_private.clinical_access(clinic_id,patient_id));
create trigger clinical_media_events_immutable before update or delete on public.aura_clinical_media_events
 for each row execute function aura_private.clinical_immutable();
create function aura_private.clinical_media_immutable() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'Clinical originals are retained' using errcode='42501'; end if;
 if old.state<>'pending' or new.state<>'ready' or
  (to_jsonb(new)-array['state','display_sha256','display_size','width','height','scan_engine','scanned_at','completed_at'])
   is distinct from (to_jsonb(old)-array['state','display_sha256','display_size','width','height','scan_engine','scanned_at','completed_at']) then
  raise exception 'Clinical media metadata is immutable' using errcode='42501';
 end if;
 return new;
end;$$;
revoke all on function aura_private.clinical_media_immutable() from public,anon,authenticated;
create trigger clinical_media_immutable before update or delete on public.aura_clinical_media
 for each row execute function aura_private.clinical_media_immutable();

create function aura_private.clinical_media_rpc(p_action text,p_clinic uuid,p_patient text,p_body jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); a public.aura_clinical_access; m public.aura_clinical_media;
 result jsonb; target_media_id uuid; request_hash text; d jsonb; at_time timestamptz;
begin
 if actor is null or not aura_private.clinical_access(p_clinic,p_patient,case when p_action in ('authorize_upload','reserve','publicity_revoke') then 'write' when p_action='export' then 'export' else 'read' end) then raise exception 'Clinical access denied' using errcode='42501'; end if;
 if jsonb_typeof(p_body) is distinct from 'object' or octet_length(p_body::text)>8000 then raise exception 'Invalid media request' using errcode='22023'; end if;
 perform aura_private.limit_request('clinical_media',120);
 select * into a from public.aura_clinical_access where clinic_id=p_clinic and patient_id=p_patient and user_id=actor;
 if p_action='authorize_upload' then
  result=jsonb_build_object('allowed',true);
 elsif p_action='list' then
  select coalesce(jsonb_agg(x.item order by x.captured_at desc,x.id desc),'[]') into result from (
   select jsonb_build_object('id',id,'entryId',entry_id,'capturedAt',captured_at,'stage',stage,'region',region,'notes',notes,'mime',mime,'state',state,
    'width',width,'height',height,'clinicalBasis',clinical_basis,'basisReference',basis_reference,'processingBasisReference',processing_basis_reference,'professionalName',professional_name,'registry',registry,'originalSha256',original_sha256,
    'publicityRevoked',exists(select 1 from public.aura_clinical_media_events e where e.media_id=cm.id and e.action='publicity_revoked')) item,captured_at,id
   from public.aura_clinical_media cm where clinic_id=p_clinic and patient_id=p_patient
    and (state='ready' or uploaded_by=actor)
    and (coalesce(p_body->>'before','')='' or (captured_at,id)<((p_body->>'before')::timestamptz,(p_body->>'beforeId')::uuid))
   order by captured_at desc,id desc limit 50
  ) x;
 else
  target_media_id=(p_body->>'id')::uuid;
  if target_media_id is null then raise exception 'Media identifier required' using errcode='22023'; end if;
  -- Serialize reserve/retry/commit for this media ID without overwriting objects.
  perform pg_advisory_xact_lock(hashtextextended(target_media_id::text,1));
  select * into m from public.aura_clinical_media where id=target_media_id for update;
  if m.id is not null and (m.clinic_id<>p_clinic or m.patient_id<>p_patient) then raise exception 'Clinical access denied' using errcode='42501'; end if;
  if p_action='reserve' then
   d=p_body-'id';at_time=(d->>'capturedAt')::timestamptz;
   if at_time is null then raise exception 'Capture date required' using errcode='22023'; end if;
   request_hash=encode(sha256(convert_to(jsonb_set(d,'{capturedAt}',to_jsonb(extract(epoch from at_time)))::text,'UTF8')),'hex');
   if m.id is not null then
    if m.uploaded_by<>actor or m.request_hash<>request_hash then raise exception 'Media request changed' using errcode='22023'; end if;
   else
    at_time=(d->>'capturedAt')::timestamptz;
    if at_time is null or at_time>now()+interval '5 minutes' or (d->>'size')::integer not between 1 and 4000000
     or coalesce(d->>'sha256','') !~ '^[a-f0-9]{64}$' or coalesce(d->>'mime','') not in ('image/jpeg','image/png','image/webp','application/pdf')
     or coalesce(d->>'stage','') not in ('before','immediate','follow_up','attachment')
     or coalesce(d->>'clinicalBasis','') not in ('consent_documented','care_basis_reviewed')
     or length(btrim(coalesce(d->>'basisReference',''))) not between 5 and 500
     or length(btrim(coalesce(d->>'processingBasisReference',''))) not between 5 and 500
     or length(coalesce(d->>'region',''))>120 or length(coalesce(d->>'notes',''))>2000
     or ((d->>'mime'='application/pdf') is distinct from (d->>'stage'='attachment')) then raise exception 'Invalid media metadata' using errcode='22023'; end if;
    perform 1 from public.aura_clinics c where c.id=p_clinic and exists(select 1 from jsonb_array_elements(c.data->'patients') p where p->>'id'=p_patient) for update;
    if not found then raise exception 'Patient not found' using errcode='22023'; end if;
    if coalesce(d->>'entryId','')<>'' and not exists(select 1 from public.aura_clinical_entries where id=(d->>'entryId')::uuid and clinic_id=p_clinic and patient_id=p_patient) then raise exception 'Invalid clinical session' using errcode='22023'; end if;
    insert into public.aura_clinical_patients(clinic_id,patient_id) values(p_clinic,p_patient) on conflict do nothing;
    insert into public.aura_clinical_media(id,clinic_id,patient_id,uploaded_by,professional_id,professional_name,registry,entry_id,captured_at,stage,region,notes,clinical_basis,basis_reference,processing_basis_reference,mime,original_size,original_sha256,request_hash)
     values(target_media_id,p_clinic,p_patient,actor,a.professional_id,(select c.data->'names'->>a.professional_id from public.aura_clinics c where c.id=p_clinic),a.registry,nullif(d->>'entryId','')::uuid,at_time,d->>'stage',coalesce(d->>'region',''),coalesce(d->>'notes',''),d->>'clinicalBasis',d->>'basisReference',d->>'processingBasisReference',d->>'mime',(d->>'size')::integer,d->>'sha256',request_hash) returning * into m;
    insert into public.aura_clinical_media_events(media_id,actor_id,action) values(target_media_id,actor,'reserved');
   end if;
   result=jsonb_build_object('id',m.id,'state',m.state,'sha256',m.original_sha256,'mime',m.mime);
  elsif p_action in ('view','export','publicity_revoke') then
   if m.id is null or m.state<>'ready' then raise exception 'Media unavailable' using errcode='42501'; end if;
   if p_action='export' and coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'CLINICAL_MFA_REQUIRED' using errcode='42501'; end if;
   if p_action='view' and m.mime='application/pdf' then raise exception 'PDF requires authorized export' using errcode='42501'; end if;
   if p_action<>'publicity_revoke' or not exists(select 1 from public.aura_clinical_media_events where media_id=m.id and action='publicity_revoked') then
    insert into public.aura_clinical_media_events(media_id,actor_id,action) values(target_media_id,actor,case when p_action='publicity_revoke' then 'publicity_revoked' else p_action end);
   end if;
   result=jsonb_build_object('id',m.id,'mime',m.mime,'sha256',case when p_action='export' then m.original_sha256 else m.display_sha256 end,
    'bucket',case when p_action='export' then 'pellum-clinical-originals' else 'pellum-clinical-display' end,
    'path',m.clinic_id::text||'/'||m.id::text||case when p_action='export' then '/original' else '/display.jpg' end);
  else raise exception 'Invalid media action' using errcode='22023'; end if;
 end if;
 insert into public.aura_clinical_audit(clinic_id,patient_id,actor_id,action) values(p_clinic,p_patient,actor,'media.'||p_action);
 return result;
end;$$;
revoke all on function aura_private.clinical_media_rpc(text,uuid,text,jsonb) from public,anon;
grant execute on function aura_private.clinical_media_rpc(text,uuid,text,jsonb) to authenticated;
create function public.aura_clinical_media_rpc(p_action text,p_clinic uuid,p_patient text,p_body jsonb default '{}')
returns jsonb language sql security invoker set search_path='' as $$select aura_private.clinical_media_rpc(p_action,p_clinic,p_patient,p_body)$$;
revoke all on function public.aura_clinical_media_rpc(text,uuid,text,jsonb) from public,anon;
grant execute on function public.aura_clinical_media_rpc(text,uuid,text,jsonb) to authenticated;

-- Only the trusted backend may attest to scanner/decoder results. Claims must
-- come from a token freshly verified by Supabase Auth, never from request JSON.
create function aura_private.clinical_media_commit(p_id uuid,p_claims jsonb,p_body jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.aura_clinical_media; old_claims text:=current_setting('request.jwt.claims',true);
begin
 perform set_config('request.jwt.claims',p_claims::text,true);
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,1));
 select * into m from public.aura_clinical_media where id=p_id for update;
 if m.id is null or m.uploaded_by is distinct from auth.uid() or not aura_private.clinical_access(m.clinic_id,m.patient_id,'write') then raise exception 'Clinical access denied' using errcode='42501'; end if;
 if m.original_sha256 is distinct from p_body->>'originalSha256' or coalesce(p_body->>'scanEngine','')='' then raise exception 'Invalid processing evidence' using errcode='22023'; end if;
 if m.state<>'ready' then
  update public.aura_clinical_media set state='ready',display_sha256=p_body->>'displaySha256',display_size=(p_body->>'displaySize')::integer,
   width=(p_body->>'width')::integer,height=(p_body->>'height')::integer,scan_engine=p_body->>'scanEngine',scanned_at=now(),completed_at=now() where id=p_id;
  insert into public.aura_clinical_media_events(media_id,actor_id,action) values(p_id,auth.uid(),'ready');
  insert into public.aura_clinical_audit(clinic_id,patient_id,actor_id,action) values(m.clinic_id,m.patient_id,auth.uid(),'media.ready');
 end if;
 perform set_config('request.jwt.claims',coalesce(old_claims,''),true);
 return jsonb_build_object('id',p_id,'state','ready');
end;$$;
revoke all on function aura_private.clinical_media_commit(uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function aura_private.clinical_media_commit(uuid,jsonb,jsonb) to service_role;
create function public.aura_clinical_media_commit(p_id uuid,p_claims jsonb,p_body jsonb)
returns jsonb language sql security invoker set search_path='' as $$select aura_private.clinical_media_commit(p_id,p_claims,p_body)$$;
revoke all on function public.aura_clinical_media_commit(uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.aura_clinical_media_commit(uuid,jsonb,jsonb) to service_role;
commit;
