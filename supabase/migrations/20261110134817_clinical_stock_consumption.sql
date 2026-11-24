begin;
create table aura_private.clinical_stock (
 entry_id uuid primary key,clinic_id uuid not null,patient_id text not null,
 actor_id uuid not null references auth.users(id) on delete restrict,
 materials jsonb not null check(jsonb_typeof(materials)='array'),created_at timestamptz not null default now(),
 foreign key(entry_id,clinic_id,patient_id) references public.aura_clinical_entries(id,clinic_id,patient_id) on delete restrict
);
create table aura_private.clinical_stock_requests (
 actor_id uuid not null references auth.users(id) on delete restrict,request_id uuid not null,
 body_hash text not null,response jsonb not null,primary key(actor_id,request_id)
);
alter table aura_private.clinical_stock enable row level security;
alter table aura_private.clinical_stock_requests enable row level security;
revoke all on aura_private.clinical_stock,aura_private.clinical_stock_requests from public,anon,authenticated;
create trigger clinical_stock_immutable before update or delete on aura_private.clinical_stock for each row execute function aura_private.clinical_immutable();
create trigger clinical_stock_requests_immutable before update or delete on aura_private.clinical_stock_requests for each row execute function aura_private.clinical_immutable();

create function aura_private.clinical_stock_snapshot_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare p jsonb;m jsonb;
begin
 for p,m in select product,movement from jsonb_array_elements(old.data->'products') product cross join jsonb_array_elements(product->'movements') movement where movement->>'type'='clinical_consumption' loop
  if not exists(select 1 from jsonb_array_elements(new.data->'products') np cross join jsonb_array_elements(np->'movements') nm where np->>'id'=p->>'id' and nm=m) then raise exception 'CLINICAL_STOCK_HISTORY_PROTECTED' using errcode='22023';end if;
 end loop;
 for p,m in select product,movement from jsonb_array_elements(new.data->'products') product cross join jsonb_array_elements(product->'movements') movement where movement->>'type'='clinical_consumption' loop
  if not exists(select 1 from aura_private.clinical_stock s cross join jsonb_array_elements(s.materials) material where s.clinic_id=new.id and s.entry_id::text=m->>'clinicalEntryId' and material->>'id'=p->>'id' and material->'stockApplied'='true'::jsonb and material->>'mid'=m->>'materialId' and material->>'mid'=m->>'id' and (material->>'qty')::numeric=-(m->>'qty')::numeric) then raise exception 'CLINICAL_STOCK_HISTORY_PROTECTED' using errcode='22023';end if;
 end loop;
 return new;
end;$$;
revoke all on function aura_private.clinical_stock_snapshot_guard() from public,anon,authenticated;
create trigger clinical_stock_snapshot_guard before update of data on public.aura_clinics for each row execute function aura_private.clinical_stock_snapshot_guard();

-- Reuse the legacy monetary/balance validator without manufacturing a financial
-- record. Only this private transformation maps a clinical debit to a loss for
-- arithmetic validation; persisted movement type remains clinical_consumption.
create function aura_private.stock_validation_state(d jsonb) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_set(d,'{products}',coalesce((select jsonb_agg(jsonb_set(p,'{movements}',coalesce((select jsonb_agg(case when m->>'type'='clinical_consumption' then jsonb_set(m,'{type}','"loss"') else m end order by mi) from jsonb_array_elements(p->'movements') with ordinality x(m,mi)),'[]')) order by pi) from jsonb_array_elements(d->'products') with ordinality x(p,pi)),'[]'));
$$;
revoke all on function aura_private.stock_validation_state(jsonb) from public,anon,authenticated;
alter function aura_private.assert_state(jsonb,jsonb) rename to assert_state_before_clinical_stock;
revoke all on function aura_private.assert_state_before_clinical_stock(jsonb,jsonb) from public,anon,authenticated;
create function aura_private.assert_state(d jsonb,old_d jsonb default '{}') returns void language plpgsql set search_path='' as $$
declare previous jsonb;current_movements jsonb;
begin
 select coalesce(jsonb_agg(jsonb_build_array(p->>'id',m) order by p->>'id',m->>'id'),'[]') into previous from jsonb_array_elements(coalesce(old_d->'products','[]')) p cross join jsonb_array_elements(p->'movements') m where m->>'type'='clinical_consumption';
 select coalesce(jsonb_agg(jsonb_build_array(p->>'id',m) order by p->>'id',m->>'id'),'[]') into current_movements from jsonb_array_elements(d->'products') p cross join jsonb_array_elements(p->'movements') m where m->>'type'='clinical_consumption';
 -- Legacy restore first validates against {}. The table trigger below checks
 -- its actual OLD row and ledger when the restore is written, so a compatible
 -- restore remains possible without allowing a prior debit to disappear.
 if old_d<>'{}'::jsonb and previous is distinct from current_movements then raise exception 'CLINICAL_STOCK_HISTORY_PROTECTED' using errcode='22023';end if;
 perform aura_private.assert_state_before_clinical_stock(aura_private.stock_validation_state(d),aura_private.stock_validation_state(old_d));
end;$$;
revoke all on function aura_private.assert_state(jsonb,jsonb) from public,anon,authenticated;

create function aura_private.clinical_stock_version() returns trigger language plpgsql security definer set search_path='' as $$
declare materials jsonb;
begin
 select s.materials into materials from aura_private.clinical_stock s where s.entry_id=new.entry_id and s.clinic_id=new.clinic_id and s.patient_id=new.patient_id;
 if found then
  new.payload=new.payload||jsonb_build_object('materials',materials,'materialsOrigin','clinical_stock','stockReview',case when exists(select 1 from jsonb_array_elements(materials) m where m->'stockApplied'='false'::jsonb) then 'pending' else 'recorded' end);
  new.digest=encode(sha256(convert_to(jsonb_build_array(new.entry_id,new.version,new.author_id,new.occurred_at,new.status,new.correction_reason,new.payload)::text,'UTF8')),'hex');
 end if;
 return new;
end;$$;
revoke all on function aura_private.clinical_stock_version() from public,anon,authenticated;
create trigger clinical_stock_version before insert on public.aura_clinical_versions for each row execute function aura_private.clinical_stock_version();

create function aura_private.clinical_stock_rpc(p_action text,p_clinic uuid,p_patient text,p_body jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
<<stock_request>>
declare actor uuid:=auth.uid();clinic public.aura_clinics;entry public.aura_clinical_entries;prior public.aura_clinical_versions;
 request_id uuid;hash text;cached aura_private.clinical_stock_requests;item jsonb;product jsonb;products jsonb;next_state jsonb;materials jsonb:='[]';
 result jsonb;qty numeric;cost numeric;position integer;movement_id uuid;apply_stock boolean;seen text[]:='{}';target uuid;
begin
 if actor is null or not aura_private.can_access(p_clinic,false) then raise exception 'Clinical stock access denied' using errcode='42501';end if;
 select * into clinic from public.aura_clinics where id=p_clinic for update;
 if not aura_private.clinical_access(p_clinic,p_patient,'write') then raise exception 'Clinical stock access denied' using errcode='42501';end if;
 if jsonb_typeof(p_body) is distinct from 'object' or octet_length(p_body::text)>16000 then raise exception 'Invalid stock request' using errcode='22023';end if;
 perform aura_private.limit_request('clinical_stock',60);
 if p_action='options' then
  select coalesce(jsonb_agg(jsonb_build_object('id',p->'id','name',p->'name','lot',p->'lot','expiry',p->'expiry','balance',p->'balance','unit',p->'unit','owner',p->'owner','ownerName',clinic.data->'names'->((p->>'owner')::integer),'unitCost',round((p->>'price')::numeric/(p->>'quantity')::numeric,6))),'[]') into result from jsonb_array_elements(clinic.data->'products') p where not coalesce((p->>'deleted')::boolean,false) and not coalesce(clinic.data->'inactivePros','[]') @> jsonb_build_array(p->'owner') and (coalesce(p->>'expiry','')='' or (p->>'expiry')::date>=current_date);
  return jsonb_build_object('revision',clinic.revision,'products',result);
 end if;
 if p_action<>'consume' then raise exception 'Invalid stock action' using errcode='22023';end if;
 request_id=(p_body->>'requestId')::uuid;
 if request_id is null then raise exception 'Request ID required' using errcode='22023';end if;
 hash=encode(sha256(convert_to(jsonb_build_array(p_action,p_clinic,p_patient,p_body)::text,'UTF8')),'hex');
 select * into cached from aura_private.clinical_stock_requests r where r.actor_id=actor and r.request_id=stock_request.request_id;
 if found then
  if cached.body_hash<>hash then raise exception 'Request ID reused' using errcode='22023';end if;
  return cached.response;
 end if;
 target=(p_body->>'entryId')::uuid;
 select * into entry from public.aura_clinical_entries e where e.id=target and e.clinic_id=p_clinic and e.patient_id=p_patient;
 if not found or entry.author_id<>actor then raise exception 'Clinical stock entry denied' using errcode='42501';end if;
 if entry.kind<>'procedure' or not entry.finalized then raise exception 'CLINICAL_STOCK_REVIEW_REQUIRED' using errcode='22023';end if;
 if entry.latest_version is distinct from (p_body->>'version')::integer or clinic.revision is distinct from (p_body->>'revision')::bigint then raise exception 'CLINICAL_STOCK_CONFLICT' using errcode='40001';end if;
 select * into prior from public.aura_clinical_versions v where v.entry_id=target and v.version=entry.latest_version;
 if coalesce(prior.payload->>'financialRecordId','')<>'' or exists(select 1 from aura_private.clinical_stock s where s.entry_id=target) then raise exception 'CLINICAL_STOCK_ALREADY_RECORDED' using errcode='22023';end if;
 if jsonb_typeof(p_body->'items') is distinct from 'array' then raise exception 'Invalid items' using errcode='22023';end if;
 if jsonb_array_length(p_body->'items') not between 1 and 20 then raise exception 'Select 1 to 20 items' using errcode='22023';end if;
 products=clinic.data->'products';
 for item in select * from jsonb_array_elements(p_body->'items') loop
  if jsonb_typeof(item)<>'object' or exists(select 1 from jsonb_object_keys(item) k where k not in ('id','qty')) or not aura_private.valid_number(item->'qty',0.001,1000000,3) or coalesce(item->>'id','')=any(seen) then raise exception 'Invalid or repeated material' using errcode='22023';end if;
  seen=array_append(seen,item->>'id');qty=(item->>'qty')::numeric;
  select p,(i-1)::integer into product,position from jsonb_array_elements(products) with ordinality x(p,i) where p->>'id'=item->>'id';
  if not found or coalesce((product->>'deleted')::boolean,false) or coalesce(clinic.data->'inactivePros','[]') @> jsonb_build_array(product->'owner') then raise exception 'CLINICAL_STOCK_UNAVAILABLE' using errcode='22023';end if;
  if coalesce(product->>'expiry','')<>'' and (product->>'expiry')::date<current_date then raise exception 'CLINICAL_STOCK_EXPIRED' using errcode='22023';end if;
  apply_stock=(product->>'balance')::numeric>=qty;
  cost=round((product->>'price')::numeric/(product->>'quantity')::numeric*qty,2);movement_id=gen_random_uuid();
  materials=materials||jsonb_build_array(jsonb_build_object('id',product->'id','mid',movement_id,'name',product->'name','lot',product->'lot','expiry',product->'expiry','qty',qty,'unit',product->'unit','cost',cost,'owner',product->'owner','manufacturer',coalesce(product->'manufacturer','""'),'brand',coalesce(product->'brand','""'),'stockApplied',apply_stock));
  if apply_stock then
  product=jsonb_set(product,'{balance}',to_jsonb((product->>'balance')::numeric-qty));
  product=jsonb_set(product,'{movements}',product->'movements'||jsonb_build_array(jsonb_build_object('id',movement_id,'type','clinical_consumption','clinicalEntryId',target,'materialId',movement_id,'date',current_date,'qty',-qty,'reason','Consumo clínico')));
  products=jsonb_set(products,array[position::text],product);
  end if;
 end loop;
 next_state=jsonb_set(clinic.data,'{products}',products);
 perform aura_private.assert_state_before_clinical_stock(aura_private.stock_validation_state(next_state),aura_private.stock_validation_state(clinic.data));
 insert into aura_private.clinical_stock(entry_id,clinic_id,patient_id,actor_id,materials) values(target,p_clinic,p_patient,actor,materials);
 result=aura_private.clinical_rpc('save',p_clinic,p_patient,jsonb_build_object('id',target,'version',entry.latest_version,'kind','procedure','status','addendum','occurredAt',prior.occurred_at,'payload',prior.payload,'reason','Registro de materiais consumidos, com baixa de estoque conferida pelo profissional.','requestId',gen_random_uuid()));
 insert into public.aura_history(clinic_id,actor,action,data,revision) values(p_clinic,(select lower(email) from auth.users where id=actor),'Consumo de materiais clínicos',clinic.data,clinic.revision);
 update public.aura_clinics set data=next_state,revision=revision+1,updated_at=now() where id=p_clinic;
 result=result||jsonb_build_object('clinicRevision',clinic.revision+1,'stockReviewRequired',exists(select 1 from jsonb_array_elements(materials) m where m->'stockApplied'='false'::jsonb));
 insert into aura_private.clinical_stock_requests(actor_id,request_id,body_hash,response) values(actor,request_id,hash,result);
 return result;
end;$$;
revoke all on function aura_private.clinical_stock_rpc(text,uuid,text,jsonb) from public,anon;
grant execute on function aura_private.clinical_stock_rpc(text,uuid,text,jsonb) to authenticated;
create function public.aura_clinical_stock_rpc(p_action text,p_clinic uuid,p_patient text,p_body jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select aura_private.clinical_stock_rpc(p_action,p_clinic,p_patient,p_body)$$;
revoke all on function public.aura_clinical_stock_rpc(text,uuid,text,jsonb) from public,anon;
grant execute on function public.aura_clinical_stock_rpc(text,uuid,text,jsonb) to authenticated;
commit;
