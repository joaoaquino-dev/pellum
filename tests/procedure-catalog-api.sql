-- Append after procedure-catalog.sql. All accounts and data are transaction fixtures.
reset role;
insert into auth.sessions(id,user_id,created_at,updated_at) values(current_setting('aura.sid1')::uuid,current_setting('aura.uid1')::uuid,now(),now());
set local role authenticated;
select pg_temp.as_user('1','aal2');
select pg_temp.check_ok((public.aura_rpc('save',current_setting('aura.clinic1')::uuid,jsonb_build_object('revision',3,'data',current_setting('aura.onboarding_fixture')::jsonb,'requestId',gen_random_uuid()))->>'revision')::int=4,'save browser custom procedure through authenticated RPC');
select pg_temp.check_ok(public.aura_rpc('get',current_setting('aura.clinic1')::uuid,'{}')->'data'->'customProcedures'='["Drenagem linfática"]'::jsonb,'custom procedure persists through authenticated RPC');
select pg_temp.as_user('2','aal2');
select pg_temp.denied('get',current_setting('aura.clinic1')::uuid,'{}');
reset role;
