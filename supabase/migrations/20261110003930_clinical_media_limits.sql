-- Explicit operator-set storage budgets, not a billing plan or paid entitlement.
begin;
create table aura_private.clinical_media_limits (
 clinic_id uuid primary key references public.aura_clinics(id) on delete restrict,
 max_bytes bigint not null check(max_bytes between 0 and 1099511627776),
 max_files integer not null check(max_files between 0 and 1000000),
 max_pending integer not null check(max_pending between 0 and 10000),
 reserved_bytes bigint not null default 0 check(reserved_bytes>=0),
 file_count integer not null default 0 check(file_count>=0),
 pending_count integer not null default 0 check(pending_count>=0)
);
alter table aura_private.clinical_media_limits enable row level security;
revoke all on aura_private.clinical_media_limits from public,anon,authenticated;
create function aura_private.clinical_media_budget() returns trigger language plpgsql security definer set search_path='' as $$
declare budget aura_private.clinical_media_limits; reservation bigint;
begin
 select * into budget from aura_private.clinical_media_limits where clinic_id=new.clinic_id for update;
 if not found then raise exception 'MEDIA_BUDGET_NOT_CONFIGURED' using errcode='54000'; end if;
 reservation=new.original_size+case when new.mime='application/pdf' then 0 else 4000000 end;
 if tg_op='INSERT' then
  if budget.reserved_bytes+reservation>budget.max_bytes or budget.file_count+1>budget.max_files or budget.pending_count+1>budget.max_pending then raise exception 'MEDIA_BUDGET_EXCEEDED' using errcode='54000'; end if;
  update aura_private.clinical_media_limits set reserved_bytes=reserved_bytes+reservation,file_count=file_count+1,pending_count=pending_count+1 where clinic_id=new.clinic_id;
 elsif old.state='pending' and new.state='ready' then
  update aura_private.clinical_media_limits set reserved_bytes=reserved_bytes-reservation+new.original_size+coalesce(new.display_size,0),pending_count=pending_count-1 where clinic_id=new.clinic_id;
 end if;
 return new;
end;$$;
revoke all on function aura_private.clinical_media_budget() from public,anon,authenticated;
create trigger clinical_media_budget before insert or update on public.aura_clinical_media for each row execute function aura_private.clinical_media_budget();
create function aura_private.configure_clinical_media_limits(p_clinic uuid,p_bytes bigint,p_files integer,p_pending integer)
returns void language plpgsql security definer set search_path='' as $$
declare used_bytes bigint;used_files integer;used_pending integer;
begin
 perform 1 from public.aura_clinics where id=p_clinic for update;
 if not found then raise exception 'Unknown clinic' using errcode='22023';end if;
 perform 1 from aura_private.clinical_media_limits where clinic_id=p_clinic for update;
 select coalesce(sum(original_size+case when mime='application/pdf' then 0 when state='pending' then 4000000 else coalesce(display_size,0) end),0),count(*),count(*) filter(where state='pending')
 into used_bytes,used_files,used_pending from public.aura_clinical_media where clinic_id=p_clinic;
 if p_bytes<used_bytes or p_files<used_files or p_pending<used_pending then raise exception 'Existing records exceed proposed budget' using errcode='22023';end if;
 insert into aura_private.clinical_media_limits(clinic_id,max_bytes,max_files,max_pending,reserved_bytes,file_count,pending_count)
 values(p_clinic,p_bytes,p_files,p_pending,used_bytes,used_files,used_pending)
 on conflict(clinic_id) do update set max_bytes=excluded.max_bytes,max_files=excluded.max_files,max_pending=excluded.max_pending,reserved_bytes=excluded.reserved_bytes,file_count=excluded.file_count,pending_count=excluded.pending_count;
end;$$;
revoke all on function aura_private.configure_clinical_media_limits(uuid,bigint,integer,integer) from public,anon,authenticated;
grant execute on function aura_private.configure_clinical_media_limits(uuid,bigint,integer,integer) to service_role;
create function public.aura_configure_media_limits(p_clinic uuid,p_bytes bigint,p_files integer,p_pending integer) returns void language sql security invoker set search_path='' as $$select aura_private.configure_clinical_media_limits(p_clinic,p_bytes,p_files,p_pending)$$;
revoke all on function public.aura_configure_media_limits(uuid,bigint,integer,integer) from public,anon,authenticated;
grant execute on function public.aura_configure_media_limits(uuid,bigint,integer,integer) to service_role;
create function aura_private.clinical_media_usage(p_clinic uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not aura_private.can_access(p_clinic,false) or not exists(select 1 from public.aura_clinics where id=p_clinic and owner_id=auth.uid()) then raise exception 'Usage access denied' using errcode='42501';end if;
 select jsonb_build_object('configured',true,'limitBytes',max_bytes,'reservedBytes',reserved_bytes,'files',file_count,'pending',pending_count) into result from aura_private.clinical_media_limits where clinic_id=p_clinic;
 return coalesce(result,jsonb_build_object('configured',false));
end;$$;
revoke all on function aura_private.clinical_media_usage(uuid) from public,anon;
grant execute on function aura_private.clinical_media_usage(uuid) to authenticated;
create function public.aura_clinical_media_usage(p_clinic uuid) returns jsonb language sql security invoker set search_path='' as $$select aura_private.clinical_media_usage(p_clinic)$$;
revoke all on function public.aura_clinical_media_usage(uuid) from public,anon;
grant execute on function public.aura_clinical_media_usage(uuid) to authenticated;
commit;
