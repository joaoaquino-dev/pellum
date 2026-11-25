DO $patch$
DECLARE
 target_fn regprocedure;
 definition text;
BEGIN
 target_fn := COALESCE(
  to_regprocedure('aura_private.assert_state_before_clinical_stock(jsonb,jsonb)'),
  to_regprocedure('aura_private.assert_state(jsonb,jsonb)')
 );
 IF target_fn IS NULL THEN
  RAISE EXCEPTION 'State validator function not found';
 END IF;
 definition := pg_get_functiondef(target_fn);
 IF position($check$'procedurePrices'$check$ in definition) > 0 THEN
  RETURN;
 END IF;
 IF position($needle$'customProcedures','hiddenProcedures'))$needle$ in definition) = 0 THEN
  RAISE EXCEPTION 'Unexpected state validator; review required';
 END IF;
 definition := replace(
  definition,
  $needle$'customProcedures','hiddenProcedures'))$needle$,
  $new$'customProcedures','hiddenProcedures','procedurePrices'))$new$
 );
 definition := replace(
  definition,
  ' foreach col in array',
  $validation$
 if d ? 'procedurePrices' then
  if jsonb_typeof(d->'procedurePrices') is distinct from 'object' then raise exception 'Preços padrão inválidos' using errcode='22023';end if;
  if (select count(*) from jsonb_object_keys(d->'procedurePrices'))>200 then raise exception 'Limite de preços padrão excedido' using errcode='22023';end if;
  if exists(select 1 from jsonb_each(d->'procedurePrices') x(k,v) where length(trim(k)) not between 1 and 120 or trim(k)<>k or not aura_private.valid_number(v,0,100000000,2)) then raise exception 'Preço padrão inválido' using errcode='22023';end if;
 end if;
 foreach col in array$validation$
 );
 EXECUTE definition;
END
$patch$;
