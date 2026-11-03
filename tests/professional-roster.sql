-- Append after tests/security-supabase.sql in a BEGIN/ROLLBACK transaction.
reset role;
create function pg_temp.team_accept(d jsonb,old_d jsonb default '{}') returns void language plpgsql as $$begin perform aura_private.assert_state(d,old_d);perform pg_temp.check_ok(true,'valid professional roster snapshot');end$$;
create function pg_temp.team_reject(d jsonb,old_d jsonb default '{}') returns void language plpgsql as $$declare blocked boolean=false;begin begin perform aura_private.assert_state(d,old_d);exception when sqlstate '22023' then blocked=true;end;perform pg_temp.check_ok(blocked,'invalid professional roster blocked');end$$;
select set_config('aura.team_solo','{"names":["Gestora 1","Gestora 2","Sofia Teste"],"percent":70,"patients":[{"id":"p1","name":"Paciente fictícia","phone":"","note":""}],"appointments":[],"records":[{"price":1000,"discount":0,"percent":100,"cost1":0,"cost2":0,"fee":0,"feeOwner":"0","procedure":"Toxina botulínica","mode":"gross","professionalIds":[2],"professionalNames":["Sofia Teste"],"patient":"p1","date":"2026-10-28","collector":0,"received":0,"installments":1,"due":"2026-10-28","parent":"","paid":false,"id":"teamRecord","settled":false,"transferred":0,"materials":[],"payments":[],"initialReceived":0,"schedule":[{"date":"2026-10-28","value":1000}]}],"products":[],"expenses":[],"inactivePros":[1]}',true);
select pg_temp.team_accept(current_setting('aura.team_solo')::jsonb);
select pg_temp.team_accept('{"names":["Única profissional"],"percent":100,"patients":[],"appointments":[],"records":[],"products":[],"expenses":[],"inactivePros":[]}');
select pg_temp.team_reject(jsonb_set(current_setting('aura.team_solo')::jsonb,'{inactivePros}','[0,1,2]'));
select pg_temp.team_reject(jsonb_set(current_setting('aura.team_solo')::jsonb,'{records,0,professionalIds}','[1]'));
select pg_temp.team_reject(jsonb_set(current_setting('aura.team_solo')::jsonb,'{records,0,professionalIds}','[99]'));
select pg_temp.team_reject(jsonb_set(current_setting('aura.team_solo')::jsonb,'{records,0,professionalIds}','[2,2]'));
select pg_temp.team_reject(jsonb_set(current_setting('aura.team_solo')::jsonb,'{records,0,percent}','70'));
select pg_temp.team_reject(jsonb_set(current_setting('aura.team_solo')::jsonb,'{records,0,cost2}','1'));
select pg_temp.team_reject(jsonb_set(current_setting('aura.team_solo')::jsonb,'{records,0,professionalNames}','["Outra profissional"]'));
select pg_temp.team_reject(jsonb_set(current_setting('aura.team_solo')::jsonb,'{names}','["Gestora 1","Gestora 2"]'),current_setting('aura.team_solo')::jsonb);
select pg_temp.team_reject(jsonb_set(current_setting('aura.team_solo')::jsonb,'{records,0,professionalIds}','[0]'),current_setting('aura.team_solo')::jsonb);
select set_config('aura.team_pair',jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(current_setting('aura.valid_state')::jsonb,'{names}','["Gestora 1","Gestora 2","Sofia Teste"]'),'{records,0,professionalIds}','[0,2]'),'{records,0,professionalNames}','["Gestora 1","Sofia Teste"]'),'{products,0,owner}','2'),'{records,0,materials,0,owner}','2'),'{records,0,cost1}','0'),'{records,0,cost2}','1')::text,true);
select pg_temp.team_accept(current_setting('aura.team_pair')::jsonb);
select pg_temp.team_reject(jsonb_set(current_setting('aura.team_pair')::jsonb,'{records,0,cost2}','0'));
select pg_temp.team_reject(jsonb_set(current_setting('aura.team_pair')::jsonb,'{products,0,owner}','1'));
select pg_temp.team_accept(jsonb_set(current_setting('aura.team_pair')::jsonb,'{expenses}','[{"id":"e1","name":"Despesa fictícia","date":"2026-10-28","value":10,"owner":"2"}]'));
select pg_temp.team_reject(jsonb_set(current_setting('aura.team_pair')::jsonb,'{expenses}','[{"id":"e1","name":"Despesa fictícia","date":"2026-10-28","value":10,"owner":"9"}]'));
select pg_temp.team_accept(jsonb_set(current_setting('aura.team_pair')::jsonb,'{appointments,0,pro}','2'));
select pg_temp.team_reject(jsonb_set(current_setting('aura.team_pair')::jsonb,'{appointments,0,pro}','3'));

select pg_temp.check_ok((select jsonb_array_length(data->'names')=1 from public.aura_clinics where id=current_setting('aura.clinic2')::uuid),'new clinics start with one professional');
