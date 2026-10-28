# Onboarding, solo-friendly copy and procedure catalog

- Finance description now reads "Acompanhe seus recebimentos, custos e resultados." Calculator and agenda wording no longer assume a partnership.
- Calculator defaults to an individual attendance; selecting a partner is optional. Partnership-only headings and controls are hidden for solo attendance.
- Team settings show active professionals only. Removed professionals stay in a collapsed history section; identity, historical records and account access rules are preserved. The percentage setting is hidden for one-person teams.
- A fresh empty clinic opens "Vamos começar?" after authorized access and clinic creation. Five optional stages cover welcome, professional name, products/supplies, first patient and next actions. This does not bypass license approval or clinic creation.
- "Como usar" is always in the clinic menu and reopens the guide. Dismissal/progress are local to the browser and clinic; professional names, products and patients save through the existing clinic API. No new clinical data is stored in onboarding localStorage.
- Fixed patient creation so forms opened outside the patients page return to the correct page/guide rather than calling a missing patient-list element.
- Settings now include a clinic-specific custom procedure catalog, available to scheduling and pricing. Up to 100 additional names, at most 120 characters each. Duplicate names are blocked; existing default procedures remain.
- Additive function migration: `20261028192814_clinic_procedure_catalog`. Existing clinic data was not rewritten; RLS and commercial licensing are unchanged.

## Evidence

- 71 SQL assertions passed after migration: existing isolation/auth/MFA/state tests, professional roster, custom catalog validation and authenticated custom-catalog save/read with a second user's denied read. All fictitious accounts/clinical data rolled back.
- The exact browser-produced snapshot in `security/evidence/onboarding-browser-fixture.json` was saved and read through the authenticated RPC in a rollback transaction.
- Browser QA with simulated API: fresh-clinic automatic welcome; professional-name save and advance; optional materials step; patient creation returning to the guide; completion; adding/removing a team member with only one remaining visible; new Drenagem linfática option in pricing and agenda; successful fictional appointment.
- Node build, syntax, account-navigation regression, team-model checks, script CSP/action validation and static output allowlist passed.
- Existing Supabase advisory limitations, SMTP, backup/restore and real multi-device verification remain as previously documented. These UX changes do not constitute approval to use real patient data.

## Recovery

Use a forward fix or a compatible UI version. Preserve `customProcedures` and stable professional IDs in saved snapshots. No patients, attendance, stock or financial history was deleted.
