begin;
do $$declare s jsonb='{"names":["Profissional"],"percent":100,"inactivePros":[],"patients":[{"id":"phone-test","name":"Paciente fictícia","phone":"61987654321","note":""}],"appointments":[],"records":[],"products":[],"expenses":[]}';invalid jsonb;rejected boolean;begin
 if not aura_private.valid_brazil_phone('+55 (61) 98765-4321') or not aura_private.valid_brazil_phone('(11) 3456-7890') or not aura_private.valid_brazil_phone('') then raise exception 'Valid number rejected';end if;
 if aura_private.valid_brazil_phone('00000000000') or aura_private.valid_brazil_phone('61999999999') or aura_private.valid_brazil_phone('99999999999999999999') or aura_private.valid_brazil_phone('20987654321') or aura_private.valid_brazil_phone('abc61987654321') then raise exception 'Invalid number accepted';end if;
 perform aura_private.assert_state(s,'{}');
 invalid=jsonb_set(s,'{patients,0,phone}','"999999999999999999999"');rejected=false;
 begin perform aura_private.assert_state(invalid,'{}');exception when sqlstate '22023' then rejected=true;end;
 if not rejected then raise exception 'New invalid phone accepted';end if;
 perform aura_private.assert_state(invalid,invalid);
 perform aura_private.assert_state(s,invalid);
 rejected=false;begin perform aura_private.assert_state(jsonb_set(s,'{patients,0,phone}','"123"'),s);exception when sqlstate '22023' then rejected=true;end;
 if not rejected then raise exception 'Edited invalid phone accepted';end if;
 perform aura_private.assert_state(jsonb_set(s,'{patients,0,phone}','""'),s);
end$$;
select 'PASS: valid phones; invalid formats; new/edited rejection; legacy preservation; correction; optional empty phone' as result;
rollback;
