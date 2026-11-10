-- Local hardening; do not apply to the linked project without a separate review.
begin;

-- Keep the membership required by the legacy can_access implementation. This
-- does not change p_owner semantics or invent new manager/editor permissions.
create function aura_private.protect_clinic_owner_membership()
returns trigger language plpgsql security definer set search_path='' as $$
declare owner_email text;
begin
 select lower(u.email) into owner_email
 from public.aura_clinics c join auth.users u on u.id=c.owner_id
 where c.id=old.clinic_id;
 -- During an authorized parent-clinic deletion the parent is already absent;
 -- its FK cascade must remain able to remove all memberships.
 if found and owner_email=old.email then
  if tg_op='DELETE' then
   raise exception 'CLINIC_OWNER_MEMBERSHIP_PROTECTED' using errcode='42501';
  elsif new.email is distinct from old.email or new.clinic_id is distinct from old.clinic_id then
   raise exception 'CLINIC_OWNER_MEMBERSHIP_PROTECTED' using errcode='42501';
  end if;
 end if;
 if tg_op='DELETE' then return old;else return new;end if;
end;$$;
revoke all on function aura_private.protect_clinic_owner_membership() from public,anon,authenticated;
create trigger protect_clinic_owner_membership before delete or update on public.aura_members
for each row execute function aura_private.protect_clinic_owner_membership();

-- Removing the whole clinic must not become a way for another member to evade
-- the protected membership. Preserve explicit owner/platform-admin deletion;
-- existing RPC confirmation, MFA, audit and clinical retention checks remain.
create function aura_private.protect_clinic_owner_deletion()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is distinct from old.owner_id and not coalesce(aura_private.is_admin(),false) then
  raise exception 'CLINIC_OWNER_REQUIRED' using errcode='42501';
 end if;
 return old;
end;$$;
revoke all on function aura_private.protect_clinic_owner_deletion() from public,anon,authenticated;
create trigger protect_clinic_owner_deletion before delete on public.aura_clinics
for each row execute function aura_private.protect_clinic_owner_deletion();
commit;
