begin;
-- Native PostgreSQL only; no external index, extension or copy of clinical text.
create index clinical_versions_search_scope_date_idx on public.aura_clinical_versions(clinic_id,patient_id,occurred_at desc,entry_id desc,version desc);
create function aura_private.clinical_search_normalize(value text) returns text language sql immutable set search_path='' as $$
 select regexp_replace(translate(lower(coalesce(value,'')),'áàâãäéèêëíìîïóòôõöúùûüçñ','aaaaaeeeeiiiiooooouuuucn'),'[[:space:]]+',' ','g');
$$;
create function aura_private.clinical_search_text(payload jsonb) returns text language sql immutable set search_path='' as $$
 select aura_private.clinical_search_normalize(coalesce(string_agg(value#>>'{}',' '),'')) from jsonb_path_query(payload,'strict $.** ? (@.type() == "string" || @.type() == "number" || @.type() == "boolean")') value;
$$;
revoke all on function aura_private.clinical_search_normalize(text),aura_private.clinical_search_text(jsonb) from public,anon,authenticated;

create function aura_private.clinical_search(p_clinic uuid,p_patient text,p_body jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
<<search>>
declare query_text text;kind text;from_day date;to_day date;old_versions boolean:=false;page_size integer:=20;
 before_at timestamptz;before_id uuid;before_version integer;target uuid;target_version integer;items jsonb;has_more boolean;last_item jsonb;result jsonb;
begin
 if auth.uid() is null or not aura_private.can_access(p_clinic,false) or not aura_private.clinical_access(p_clinic,p_patient,'read') then raise exception 'Clinical search access denied' using errcode='42501';end if;
 if p_patient is null or p_patient !~ '^[A-Za-z0-9_-]{1,80}$' or jsonb_typeof(p_body) is distinct from 'object' or octet_length(p_body::text)>3000 then raise exception 'Invalid search request' using errcode='22023';end if;
 if p_body ? 'query' and jsonb_typeof(p_body->'query') is distinct from 'string' or length(coalesce(p_body->>'query',''))>200 then raise exception 'Use up to 200 search characters' using errcode='22023';end if;
 query_text=btrim(aura_private.clinical_search_normalize(p_body->>'query'));kind=coalesce(p_body->>'kind','');
 if kind<>'' and kind not in ('identity','anamnesis','evaluation','plan','procedure','evolution','adverse_event','consent') then raise exception 'Invalid record type' using errcode='22023';end if;
 if coalesce(p_body->>'from','')<>'' then if not aura_private.valid_date(p_body->>'from') then raise exception 'Invalid search date' using errcode='22023';end if;from_day=(p_body->>'from')::date;end if;
 if coalesce(p_body->>'to','')<>'' then if not aura_private.valid_date(p_body->>'to') then raise exception 'Invalid search date' using errcode='22023';end if;to_day=(p_body->>'to')::date;end if;
 if from_day>to_day then raise exception 'Invalid search period' using errcode='22023';end if;
 if p_body ? 'includeHistory' then if jsonb_typeof(p_body->'includeHistory') is distinct from 'boolean' then raise exception 'Invalid version filter' using errcode='22023';end if;old_versions=(p_body->>'includeHistory')::boolean;end if;
 if p_body ? 'limit' then if not aura_private.valid_number(p_body->'limit',1,50,0) then raise exception 'Invalid page size' using errcode='22023';end if;page_size=(p_body->>'limit')::integer;end if;
 if p_body ? 'entryId' then target=(p_body->>'entryId')::uuid;end if;
 if p_body ? 'version' then if target is null or not aura_private.valid_number(p_body->'version',1,1000000,0) then raise exception 'Invalid record version' using errcode='22023';end if;target_version=(p_body->>'version')::integer;end if;
 if p_body ? 'cursor' then
  if jsonb_typeof(p_body->'cursor') is distinct from 'object' then raise exception 'Invalid search cursor' using errcode='22023';end if;
  before_at=(p_body->'cursor'->>'at')::timestamptz;before_id=(p_body->'cursor'->>'id')::uuid;before_version=(p_body->'cursor'->>'version')::integer;
  if before_at is null or before_id is null or before_version is null or before_version<1 then raise exception 'Invalid search cursor' using errcode='22023';end if;
 end if;
 perform aura_private.limit_request('clinical_search',120);
 with matches as (
  select e.id,v.occurred_at,v.version,
   jsonb_build_object('id',e.id,'kind',e.kind,'version',v.version,'latestVersion',e.latest_version,'historical',v.version<>e.latest_version,'status',v.status,'finalized',e.finalized,'authorId',v.author_id,'professionalName',v.professional_name,'registry',v.registry,'occurredAt',v.occurred_at,'recordedAt',v.recorded_at,'createdAt',e.created_at,'reason',v.correction_reason,'payload',v.payload,'digest',v.digest) item
  from public.aura_clinical_entries e join public.aura_clinical_versions v on v.entry_id=e.id
  where e.clinic_id=p_clinic and e.patient_id=p_patient and v.clinic_id=p_clinic and v.patient_id=p_patient
   and (old_versions or target_version is not null or v.version=e.latest_version) and (search.kind='' or e.kind=search.kind) and (target is null or e.id=target) and (target_version is null or v.version=target_version)
   and (from_day is null or v.occurred_at>=(from_day::timestamp at time zone 'America/Sao_Paulo'))
   and (to_day is null or v.occurred_at<((to_day+1)::timestamp at time zone 'America/Sao_Paulo'))
   and (before_at is null or (v.occurred_at,e.id,v.version)<(before_at,before_id,before_version))
   and (query_text='' or not exists(select 1 from unnest(string_to_array(query_text,' ')) term where strpos(aura_private.clinical_search_text(v.payload),term)=0))
  order by v.occurred_at desc,e.id desc,v.version desc limit page_size+1
 ), numbered as(select *,row_number() over(order by occurred_at desc,id desc,version desc) n from matches)
 select coalesce(jsonb_agg(item order by occurred_at desc,id desc,version desc) filter(where n<=page_size),'[]'),count(*)>page_size into items,has_more from numbered;
 last_item=items->(jsonb_array_length(items)-1);
 result=jsonb_build_object('items',items,'hasMore',has_more,'cursor',case when has_more then jsonb_build_object('at',last_item->'occurredAt','id',last_item->'id','version',last_item->'version') else null end);
 -- Intentionally log only the operation, never the query or clinical payload.
 insert into public.aura_clinical_audit(clinic_id,patient_id,actor_id,action,entry_id) values(p_clinic,p_patient,auth.uid(),'search',target);
 return result;
end;$$;
revoke all on function aura_private.clinical_search(uuid,text,jsonb) from public,anon;
grant execute on function aura_private.clinical_search(uuid,text,jsonb) to authenticated;
create function public.aura_clinical_search(p_clinic uuid,p_patient text,p_body jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select aura_private.clinical_search(p_clinic,p_patient,p_body)$$;
revoke all on function public.aura_clinical_search(uuid,text,jsonb) from public,anon;
grant execute on function public.aura_clinical_search(uuid,text,jsonb) to authenticated;
commit;
