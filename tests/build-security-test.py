from pathlib import Path
import sys
migration=next(Path('supabase/migrations').glob('*_licensing_admin_security.sql')).read_text() if '--stage-migration' in sys.argv else ''
fixture=Path('security/evidence/browser-fixture.json').read_text()
print('begin;\n'+migration+'\n'+Path('tests/security-supabase.sql').read_text()+"\nselect aura_private.assert_state($fixture$"+fixture+"$fixture$::jsonb,'{}');\nselect jsonb_build_object('passed_assertions',current_setting('aura.test_count')::int,'browser_state_validated',true,'fixtures_rolled_back',true) as security_result;\nrollback;")
