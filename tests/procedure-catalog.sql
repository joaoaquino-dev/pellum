-- Append after professional-roster.sql; pg_temp helpers and fictitious state exist.
select pg_temp.team_accept(jsonb_set(current_setting('aura.team_solo')::jsonb,'{customProcedures}','["Drenagem linfática","Massagem relaxante"]'));
select pg_temp.team_reject(jsonb_set(current_setting('aura.team_solo')::jsonb,'{customProcedures}','{}'));
select pg_temp.team_reject(jsonb_set(current_setting('aura.team_solo')::jsonb,'{customProcedures}','[""]'));
select pg_temp.team_reject(jsonb_set(current_setting('aura.team_solo')::jsonb,'{customProcedures}','[" Procedimento "]'));
select pg_temp.team_reject(jsonb_set(current_setting('aura.team_solo')::jsonb,'{customProcedures}','["Drenagem","drenagem"]'));
select pg_temp.team_reject(jsonb_set(current_setting('aura.team_solo')::jsonb,'{customProcedures}','["Peeling"]'));
select pg_temp.team_reject(jsonb_set(current_setting('aura.team_solo')::jsonb,'{customProcedures}',jsonb_build_array(repeat('x',121))));
select pg_temp.team_reject(jsonb_set(current_setting('aura.team_solo')::jsonb,'{customProcedures}',(select jsonb_agg('Procedimento '||n) from generate_series(1,101) n)));
select pg_temp.team_reject(jsonb_set(current_setting('aura.team_solo')::jsonb,'{customProcedures}','[12]'));
