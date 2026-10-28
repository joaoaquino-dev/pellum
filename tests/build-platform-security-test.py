"""Generate the complete rollback-only Supabase regression suite. Never commit fixture data."""
from pathlib import Path
root = Path(__file__).resolve().parent.parent
parts = ["begin;"]
fixture = (root / "security/evidence/onboarding-browser-fixture.json").read_text()
parts.append("select set_config('aura.onboarding_fixture',$onboarding$" + fixture + "$onboarding$,true);")
for name in ["security-supabase.sql", "professional-roster.sql", "procedure-catalog.sql", "procedure-catalog-api.sql", "platform-user-deletion.sql", "owner-user-deletion.sql"]:
    parts.append((root / "tests" / name).read_text())
parts.append("select jsonb_build_object('passed_assertions',current_setting('aura.test_count')::int,'fixtures_rolled_back',true) as result;\nrollback;")
print("\n".join(parts))
