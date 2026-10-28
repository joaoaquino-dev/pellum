begin;
select set_config('aura.test_user1',gen_random_uuid()::text,true),set_config('aura.test_user2',gen_random_uuid()::text,true);
insert into auth.users(id,email,email_confirmed_at,is_anonymous) values
(current_setting('aura.test_user1')::uuid,'aura-test-owner@example.invalid',now(),false),
(current_setting('aura.test_user2')::uuid,'aura-test-other@example.invalid',now(),false);
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('aura.test_user1'),true);
do $test$
declare v jsonb; c uuid; h uuid;
begin
 v=public.aura_rpc('create',null,'{"name":"Aura transactional test"}');c=(v->>'id')::uuid;perform set_config('aura.test_clinic',c::text,true);
 v=public.aura_rpc('get',c,'{}');if (v->>'revision')::int<>0 then raise exception 'initial revision failed';end if;
 perform public.aura_rpc('save',c,jsonb_build_object('revision',0,'data',v->'data','label','test save'));
 begin perform public.aura_rpc('save',c,jsonb_build_object('revision',0,'data',v->'data'));raise exception 'stale write accepted';exception when serialization_failure then null;end;
 v=public.aura_rpc('history',c,'{}');h=(v->'history'->0->>'id')::uuid;if h is null then raise exception 'backup missing';end if;
 perform public.aura_rpc('restore',c,jsonb_build_object('revision',1,'backup',h));
 begin update public.aura_clinics set owner_id=current_setting('aura.test_user2')::uuid where id=c;raise exception 'direct update accepted';exception when insufficient_privilege then null;end;
end $test$;
select set_config('request.jwt.claim.sub',current_setting('aura.test_user2'),true);
do $test$
declare v jsonb;
begin
 if exists(select 1 from public.aura_clinics where id=current_setting('aura.test_clinic')::uuid) then raise exception 'RLS leaked clinic';end if;
 v=public.aura_rpc('get',current_setting('aura.test_clinic')::uuid,'{}');if v->'data'<>'null'::jsonb then raise exception 'RPC leaked clinic';end if;
 begin perform public.aura_rpc('save',current_setting('aura.test_clinic')::uuid,'{"revision":2,"data":{}}');raise exception 'cross clinic write accepted';exception when insufficient_privilege then null;end;
end $test$;
select set_config('request.jwt.claim.sub',current_setting('aura.test_user1'),true);
select public.aura_rpc('member',current_setting('aura.test_clinic')::uuid,'{"email":"aura-test-other@example.invalid"}');
select set_config('request.jwt.claim.sub',current_setting('aura.test_user2'),true);
do $test$
declare v jsonb;c uuid=current_setting('aura.test_clinic')::uuid;
begin
 v=public.aura_rpc('get',c,'{}');if v->'data'='null'::jsonb then raise exception 'member read denied';end if;
 perform public.aura_rpc('save',c,jsonb_build_object('revision',2,'data',v->'data'));
 begin perform public.aura_rpc('member',c,'{"email":"third@example.invalid"}');raise exception 'editor invited member';exception when insufficient_privilege then null;end;
 if exists(select 1 from public.aura_history where clinic_id=c) then raise exception 'editor read backup payload';end if;
end $test$;
select set_config('request.jwt.claim.sub',current_setting('aura.test_user1'),true);
select public.aura_rpc('member',current_setting('aura.test_clinic')::uuid,'{"email":"aura-test-other@example.invalid","remove":true}');
select set_config('request.jwt.claim.sub',current_setting('aura.test_user2'),true);
do $test$
begin
 if exists(select 1 from public.aura_clinics where id=current_setting('aura.test_clinic')::uuid) then raise exception 'revoked member retained access';end if;
end $test$;
reset role;
set local role anon;
do $test$
begin
 begin perform public.aura_rpc('get',null,'{}');raise exception 'anonymous RPC accepted';exception when insufficient_privilege then null;end;
end $test$;
rollback;
select 'PASS: clinic isolation, RLS, member access/revocation, stale writes, backup/restore and anonymous rejection; test data rolled back' as result;
