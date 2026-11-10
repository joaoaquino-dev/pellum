-- Shared clinic membership preserved; MFA is enforced only by the platform administrator RPC.
CREATE OR REPLACE FUNCTION aura_private.account_active()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select exists(select 1 from aura_private.identity() u join aura_private.licenses l on l.email=u.email where l.status='active' and (l.expires_at is null or l.expires_at>now()) and u.session_created>=l.revoked_before);
$function$

CREATE OR REPLACE FUNCTION aura_private.rpc(p_action text, p_clinic uuid, p_body jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u record;l aura_private.licenses%rowtype;v jsonb;old_data jsonb;old_revision bigint;rid uuid;h text;cached aura_private.request_results%rowtype;v_admin boolean;delete_owner uuid;delete_view jsonb;
begin
 select * into u from aura_private.identity();if u.user_id is null then raise exception 'AURA_AUTH_REQUIRED' using errcode='42501';end if;
 if jsonb_typeof(p_body)<>'object' or octet_length(p_body::text)>3000000 then raise exception 'Payload inválido' using errcode='22023';end if;
 v_admin=aura_private.is_admin();
 if p_action='get' then
  perform aura_private.limit_request('read',120);
  insert into aura_private.licenses(email) values(u.email) on conflict do nothing;
  select * into l from aura_private.licenses where email=u.email;
  if not aura_private.account_active() then return jsonb_build_object('user',u.email,'data',null,'clinics','[]'::jsonb,'is_admin',v_admin,'access',jsonb_build_object('status',case when l.status='active' and l.expires_at<=now() then 'expired' when l.status='active' and u.session_created<l.revoked_before then 'reauthenticate' else l.status end,'expires_at',l.expires_at));end if;
  if p_clinic is not null and not aura_private.can_access(p_clinic,false) then raise exception 'Clínica não autorizada' using errcode='42501';end if;
  v=aura_private.rpc_core(p_action,p_clinic,p_body);return v||jsonb_build_object('is_admin',v_admin,'access',jsonb_build_object('status','active','expires_at',l.expires_at));
 end if;
 if not aura_private.account_active() then raise exception 'AURA_ACCESS_DENIED' using errcode='42501';end if;
 if p_action not in ('create','save','restore','member','history','export','delete_preview','delete_clinic') then raise exception 'Operação inválida' using errcode='22023';end if;
 if p_action<>'create' and (p_clinic is null or not aura_private.can_access(p_clinic,false)) then raise exception 'Clínica não autorizada' using errcode='42501';end if;
 if p_action='delete_preview' then perform aura_private.limit_request('read',120);select jsonb_build_object('id',c.id,'name',c.name,'revision',c.revision,'members',(select count(*) from public.aura_members m where m.clinic_id=c.id),'patients',jsonb_array_length(coalesce(c.data->'patients','[]')),'appointments',jsonb_array_length(coalesce(c.data->'appointments','[]')),'records',jsonb_array_length(coalesce(c.data->'records','[]')),'products',jsonb_array_length(coalesce(c.data->'products','[]')),'expenses',jsonb_array_length(coalesce(c.data->'expenses','[]')),'history',(select count(*) from public.aura_history hh where hh.clinic_id=c.id)) into delete_view from public.aura_clinics c where c.id=p_clinic;return delete_view;end if;
 if p_action='history' then perform aura_private.limit_request('read',120);return aura_private.rpc_core(p_action,p_clinic,p_body);end if;
 perform aura_private.limit_request('write',30);
 begin rid=(p_body->>'requestId')::uuid;exception when others then raise exception 'Identificador de requisição inválido' using errcode='22023';end;
 if rid is null then raise exception 'Identificador de requisição ausente' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(u.user_id::text||rid::text,0));
 h=encode(sha256(convert_to(jsonb_build_object('action',p_action,'clinic',p_clinic,'body',p_body)::text,'UTF8')),'hex');
 select * into cached from aura_private.request_results r where r.user_id=u.user_id and r.request_id=rid;
 if found then if cached.body_hash<>h then raise exception 'Identificador já usado com outro conteúdo' using errcode='22023';end if;return cached.response;end if;
 if p_action='delete_clinic' then
  select c.owner_id into delete_owner from public.aura_clinics c where c.id=p_clinic;
  perform pg_advisory_xact_lock(hashtextextended(delete_owner::text,0));
  perform 1 from public.aura_clinics c where c.id=p_clinic for update;
  if not found or not aura_private.account_active() or not aura_private.can_access(p_clinic,false) then raise exception 'Clínica não autorizada' using errcode='42501';end if;
  select jsonb_build_object('id',c.id,'name',c.name,'revision',c.revision,'members',(select count(*) from public.aura_members m where m.clinic_id=c.id),'patients',jsonb_array_length(coalesce(c.data->'patients','[]')),'appointments',jsonb_array_length(coalesce(c.data->'appointments','[]')),'records',jsonb_array_length(coalesce(c.data->'records','[]')),'products',jsonb_array_length(coalesce(c.data->'products','[]')),'expenses',jsonb_array_length(coalesce(c.data->'expenses','[]')),'history',(select count(*) from public.aura_history hh where hh.clinic_id=c.id)) into delete_view from public.aura_clinics c where c.id=p_clinic;
  if p_body->'confirmed' is distinct from 'true'::jsonb or p_body->>'confirmation' is distinct from delete_view->>'name' then raise exception 'Digite o nome completo da clínica e confirme a exclusão.' using errcode='22023';end if;
  if p_body->'preview' is distinct from delete_view then raise exception 'A clínica mudou. Feche esta janela e confira novamente os dados antes de excluir.' using errcode='40001';end if;
  delete from public.aura_clinics where id=p_clinic;
  v=jsonb_build_object('ok',true,'deleted',true,'id',p_clinic);
  insert into aura_private.request_results(user_id,request_id,body_hash,response) values(u.user_id,rid,h,v);
  insert into aura_private.platform_audit(actor_id,action,target,details) values(u.user_id,'clinic.delete',p_clinic::text,jsonb_build_object('request_id',rid,'summary',delete_view));
  return v;
 end if;
 if p_action in ('save','restore') then
  select data,revision into old_data,old_revision from public.aura_clinics where id=p_clinic for update;
  if (p_body->>'revision')::bigint is distinct from old_revision then raise exception 'Outra profissional alterou a clínica. Exporte sua cópia e recarregue.' using errcode='40001';end if;
  if p_action='save' then perform aura_private.assert_state(p_body->'data',old_data);else
   select data into old_data from public.aura_history where clinic_id=p_clinic and id=(p_body->>'backup')::uuid;
   if old_data is null then raise exception 'Backup não encontrado' using errcode='22023';end if;perform aura_private.assert_state(old_data,'{}');
  end if;
 end if;
 if p_action='export' then v=jsonb_build_object('ok',true);else v=aura_private.rpc_core(p_action,p_clinic,p_body);end if;
 insert into aura_private.request_results(user_id,request_id,body_hash,response) values(u.user_id,rid,h,v);
 insert into aura_private.platform_audit(actor_id,action,target,details) values(u.user_id,'clinic.'||p_action,p_clinic::text,jsonb_build_object('request_id',rid,'revision',v->'revision'));
 return v;
end$function$

