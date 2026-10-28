# Piloto publicado — 2026-10-28

- URL: https://aura-piloto.vercel.app/
- Vercel project: aura-piloto (prj_xNNqxkDzMtJScbuTbt1Fhp5bjdRA).
- Team: joaoaquino-devs-projects (team_O1p3X85GgLd3XRyMPwZIDZfJ).
- Deployment: dpl_5b8wGVHCf49GeyWjpZFCKhyT5Tpr, READY.
- Source commit: 697a7915ca8fe3ef1ea98cd7a3dfdfdba301fd4d (security/application-review).
- Vercel target is production within the separate pilot project; this is a pilot only, not approval for real patient data. Legacy Sites deployment was not modified.
- Framework: static, standalone/dist. Only standalone dependencies installed; remote build completed successfully, npm audit reported 0 known vulnerabilities.

## Verified

- Public HTTPS GET / returned 200; CSP, no-sniff, referrer policy, HSTS and no-cache headers present.
- Browser rendered independent login and Create account form without ChatGPT login.
- Supabase Site URL is https://aura-piloto.vercel.app/; exact redirect allowlist contains that URL and https://aura-piloto.vercel.app/?mode=recovery. Saved configuration confirmed in dashboard.
- tests/security-http.py passed all 5 checks: anonymous clinic, RPC, admin RPC, private schema and empty storage bucket list.

## Remaining blockers

- Custom SMTP is OFF. Default Supabase mail service only delivers to organization team emails and has restrictive rate limits. Configure a dedicated sender before inviting wife, partner or customers. Do not grant Supabase infrastructure membership to end users to bypass this restriction.
- Actual email delivery, confirmation, recovery, authenticated multi-device tests and TOTP enrollment remain untested.
- Owner's intended admin email still must be supplied and verified; no admin was seeded or authorization bypass introduced.
- Offsite backup/restore, retention and remaining security review requirements still block real patient data.

## Recovery

For an issue in this first pilot deployment, pause/disable this Vercel project or deploy a reviewed fix. Do not republish the legacy unaudited runtime or relax database authorization to recover access. Supabase schema was unchanged by publication; only Auth return URLs were configured.
