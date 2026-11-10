CREATE OR REPLACE FUNCTION aura_private.admin_rpc(p_action text, p_body jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u record;t text;l aura_private.licenses%rowtype;st text;v jsonb;lim integer;exp timestamptz;target_id uuid;removed_members integer;
begin
 select * into u from aura_private.identity();
 if u.user_id is null or not aura_private.is_admin() then raise exception 'Administrador não autorizado' using errcode='42501';end if;
 if coalesce(auth.jwt()->>'aal','')<>'aal2' or not exists(select 1 from auth.mfa_factors f where f.user_id=u.user_id and f.status='verified') then raise exception 'AURA_MFA_REQUIRED' using errcode='42501';end if;
 if jsonb_typeof(p_body)<>'object' or octet_length(p_body::text)>5000 then raise exception 'Payload inválido' using errcode='22023';end if;
 perform aura_private.limit_request('admin',30);
 if p_action='list' then return jsonb_build_object('licenses',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select c.email,coalesce(lic.status,'pending') as status,lic.expires_at,coalesce(lic.max_clinics,3) as max_clinics,coalesce(lic.updated_at,a.created_at) as updated_at,a.id as user_id,
 case when c.email=u.email then 'Sua própria conta não pode ser excluída.'
 when exists(select 1 from aura_private.platform_admins adm where adm.email=c.email and adm.enabled) then 'Conta administrativa protegida.'
 when exists(select 1 from public.aura_clinics cl where cl.owner_id=a.id) then 'Responsável por clínica: transfira a responsabilidade antes de excluir.'
 when exists(select 1 from storage.objects obj where obj.owner=a.id or obj.owner_id=a.id::text) then 'Conta possui arquivos: resolva a responsabilidade pelos arquivos antes de excluir.'
 else null end as delete_block_reason
 from (select email from aura_private.licenses union select lower(email) from auth.users where email is not null) c
 left join aura_private.licenses lic on lic.email=c.email
 left join auth.users a on lower(a.email)=c.email
 order by coalesce(lic.updated_at,a.created_at) desc nulls last limit 200) x),'audit',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select action,target,created_at from aura_private.platform_audit where action like 'admin.%' order by created_at desc limit 50) x));end if;
 if p_action not in ('authorize','suspend','revoke_sessions','delete_user') then raise exception 'Operação administrativa inválida' using errcode='22023';end if;
 t=lower(trim(p_body->>'email'));if t is null or length(t)>254 or t !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'E-mail inválido' using errcode='22023';end if;
 select * into l from aura_private.licenses where email=t for update;

 if p_action='delete_user' then
  if lower(trim(coalesce(p_body->>'confirmation','')))<>t then raise exception 'Digite o e-mail completo para confirmar a exclusão.' using errcode='22023';end if;
  if t=u.email or exists(select 1 from aura_private.platform_admins adm where adm.email=t and adm.enabled) then raise exception 'Esta conta administrativa está protegida contra exclusão.' using errcode='22023';end if;
  select a.id into target_id from auth.users a where lower(a.email)=t;
  if target_id is null and l.email is null then raise exception 'Conta não encontrada. Atualize a lista.' using errcode='22023';end if;
  if coalesce(p_body->>'user_id','')<>coalesce(target_id::text,'') then raise exception 'A conta mudou. Atualize a lista antes de excluir.' using errcode='22023';end if;
  if target_id is not null then
   perform pg_advisory_xact_lock(hashtextextended(target_id::text,0));
   perform 1 from auth.users a where a.id=target_id for update;
   if not found then raise exception 'A conta mudou. Atualize a lista antes de excluir.' using errcode='22023';end if;
   if exists(select 1 from public.aura_clinics c where c.owner_id=target_id) then raise exception 'Conta responsável por clínica. Transfira a responsabilidade antes de excluir.' using errcode='22023';end if;
   if exists(select 1 from storage.objects obj where obj.owner=target_id or obj.owner_id=target_id::text) then raise exception 'Conta possui arquivos. Resolva a responsabilidade pelos arquivos antes de excluir.' using errcode='22023';end if;
  end if;
  delete from public.aura_members where email=t;get diagnostics removed_members=row_count;
  delete from auth.sessions where user_id=target_id;
  delete from aura_private.request_results where user_id=target_id;
  delete from aura_private.rate_limits where user_id=target_id;
  delete from auth.users where id=target_id;
  delete from aura_private.licenses where email=t;
  delete from aura_private.platform_admins where email=t and not enabled;
  insert into aura_private.platform_audit(actor_id,action,target,details) values(u.user_id,'admin.delete_user',t,jsonb_build_object('user_id',target_id,'removed_memberships',removed_members,'clinical_history_preserved',true));
  return jsonb_build_object('ok',true,'deleted',true);
 end if;
 if p_action='authorize' then
  lim=coalesce((p_body->>'max_clinics')::int,3);if lim not between 1 and 20 then raise exception 'Limite inválido' using errcode='22023';end if;
  exp=nullif(p_body->>'expires_at','')::timestamptz;if exp is not null and exp<=now() then raise exception 'Validade precisa ser futura' using errcode='22023';end if;
  insert into aura_private.licenses(email,status,expires_at,max_clinics) values(t,'active',exp,lim) on conflict(email) do update set status='active',expires_at=excluded.expires_at,max_clinics=excluded.max_clinics,updated_at=now();
 elsif p_action='suspend' then insert into aura_private.licenses(email,status,revoked_before) values(t,'suspended',now()) on conflict(email) do update set status='suspended',revoked_before=now(),updated_at=now();
 else update aura_private.licenses set revoked_before=now(),updated_at=now() where email=t;if not found then raise exception 'Conta não encontrada' using errcode='22023';end if;
 end if;
 insert into aura_private.platform_audit(actor_id,action,target,details) values(u.user_id,'admin.'||p_action,t,jsonb_build_object('previous_status',l.status,'limit',lim));return jsonb_build_object('ok',true);
end$function$
;
