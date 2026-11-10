reset role;
create function pg_temp.invalid_state(d jsonb,old_d jsonb) returns void language plpgsql as $$declare code text;begin begin perform aura_private.assert_state(d,old_d);exception when others then get stacked diagnostics code=returned_sqlstate;end;perform pg_temp.check_ok(code='22023','invalid product change rejected');end$$;
select aura_private.assert_state(jsonb_set(current_setting('aura.valid_state')::jsonb,'{products,0,name}','"Luva corrigida"'),current_setting('aura.valid_state')::jsonb);
select pg_temp.check_ok(true,'used product name editable');
select pg_temp.invalid_state(jsonb_set(current_setting('aura.valid_state')::jsonb,'{products,0,price}','100'),current_setting('aura.valid_state')::jsonb);
select aura_private.assert_state(jsonb_set(current_setting('aura.valid_state')::jsonb,'{products,0,deleted}','true'),current_setting('aura.valid_state')::jsonb);
select pg_temp.check_ok(true,'delete used product retains material references and historic costs');
select pg_temp.invalid_state(jsonb_set(current_setting('aura.valid_state')::jsonb,'{products,0,deleted}','"yes"'),current_setting('aura.valid_state')::jsonb);
select set_config('aura.unused_product',jsonb_set(jsonb_set(jsonb_set(current_setting('aura.valid_state')::jsonb,'{records}','[]'),'{products,0,movements}','[]'),'{products,0,balance}','200')::text,true);
select aura_private.assert_state(current_setting('aura.unused_product')::jsonb,'{}');
select aura_private.assert_state(jsonb_set(current_setting('aura.unused_product')::jsonb,'{products,0,price}','100'),current_setting('aura.unused_product')::jsonb);
select pg_temp.check_ok(true,'unused purchase price editable');
select aura_private.assert_state(jsonb_set(jsonb_set(current_setting('aura.unused_product')::jsonb,'{products,0,quantity}','50'),'{products,0,balance}','100'),current_setting('aura.unused_product')::jsonb);
select pg_temp.check_ok(true,'unused purchase quantity editable with recalculated balance');
select pg_temp.invalid_state(jsonb_set(current_setting('aura.unused_product')::jsonb,'{products,0,quantity}','50'),current_setting('aura.unused_product')::jsonb);
select pg_temp.invalid_state(jsonb_set(current_setting('aura.valid_state')::jsonb,'{products}','[]'),current_setting('aura.valid_state')::jsonb);
select pg_temp.invalid_state(current_setting('aura.valid_state')::jsonb,jsonb_set(current_setting('aura.unused_product')::jsonb,'{products,0,deleted}','true'));
-- New consumption of a previously deleted item cannot be smuggled in by keeping balance valid.
select pg_temp.invalid_state(jsonb_set(current_setting('aura.valid_state')::jsonb,'{products,0,deleted}','true'),jsonb_set(current_setting('aura.unused_product')::jsonb,'{products,0,deleted}','true'));
