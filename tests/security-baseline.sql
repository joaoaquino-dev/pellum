begin;
select set_config('aura.baseline_uid',gen_random_uuid()::text,true);
insert into auth.users(id,email,email_confirmed_at,is_anonymous) values(current_setting('aura.baseline_uid')::uuid,'baseline@example.invalid',now(),false);
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('aura.baseline_uid'),true);
do $test$
declare c uuid;d jsonb;r jsonb;
begin
 r=public.aura_rpc('create',null,'{"name":"Baseline fictional"}');c=(r->>'id')::uuid;perform set_config('aura.baseline_clinic',c::text,true);
 d=(public.aura_rpc('get',c,'{}'))->'data';
 d=jsonb_set(d,'{records}','[{"id":"bad","price":-9000,"patient":"missing"}]');
 perform public.aura_rpc('save',c,jsonb_build_object('revision',0,'data',d));
end $test$;
select jsonb_build_object('unlicensed_account_created_clinic',true,'invalid_financial_record_accepted',true,'read_without_live_session',((public.aura_rpc('get',current_setting('aura.baseline_clinic')::uuid,'{}'))->'data') is not null) as baseline;
rollback;
