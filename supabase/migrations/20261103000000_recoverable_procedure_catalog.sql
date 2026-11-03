DO $patch$
DECLARE definition text;
BEGIN
 definition := pg_get_functiondef('aura_private.assert_state(jsonb,jsonb)'::regprocedure);
 IF position($needle$'inactivePros','customProcedures'))$needle$ in definition)=0 THEN
  RAISE EXCEPTION 'Unexpected state validator; review required';
 END IF;
 definition := replace(definition, $needle$'inactivePros','customProcedures'))$needle$, $new$'inactivePros','customProcedures','hiddenProcedures'))$new$);
 definition := replace(definition, ' foreach col in array', $validation$
 if d ? 'hiddenProcedures' then
  if jsonb_typeof(d->'hiddenProcedures') is distinct from 'array' then raise exception 'Procedimentos excluídos inválidos' using errcode='22023';end if;
  if jsonb_array_length(d->'hiddenProcedures')>107 or exists(select 1 from jsonb_array_elements(d->'hiddenProcedures') x where jsonb_typeof(x) is distinct from 'string' or length(trim(x#>>'{}')) not between 1 and 120) then raise exception 'Procedimentos excluídos inválidos' using errcode='22023';end if;
  if (select count(*) from jsonb_array_elements(d->'hiddenProcedures'))<>(select count(distinct x) from jsonb_array_elements(d->'hiddenProcedures') x) then raise exception 'Procedimento excluído duplicado' using errcode='22023';end if;
  if exists(select 1 from jsonb_array_elements_text(d->'hiddenProcedures') x where x not in ('Toxina botulínica','Preenchimento facial','Bioestimulador de colágeno','Microagulhamento facial','Skinbooster','Peeling','Limpeza de pele') and not coalesce(d->'customProcedures','[]'::jsonb) @> jsonb_build_array(x)) then raise exception 'Procedimento excluído desconhecido' using errcode='22023';end if;
 end if;
 foreach col in array$validation$);
 EXECUTE definition;
END
$patch$;
