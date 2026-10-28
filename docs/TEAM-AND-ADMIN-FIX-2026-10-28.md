# Clinic team, admin navigation and provisional Pellum brand

## Fixed admin navigation

The platform link was prepended before a broad `.asidefoot a` selector. The logout handler was therefore bound to the admin link. Logout now targets the account control inside `small`; the admin link retains its `#admin` destination. Tests cover admin and ordinary accounts, repeated binding, and the actual logout control. A browser fixture reached the admin screen without signing out. Real account TOTP enrollment and signed-in admin RPC remain a user-assisted validation step.

## Clinic team

- New clinics start with one professional. Existing snapshots remain intact.
- Each clinic supports 1–20 professional slots; removing from the active team archives a stable ID, with reactivation available. At least one active professional remains.
- UI blocks removal while future appointments or remaining stock belong to that professional. The server denies new appointments, records and product lots for inactive professionals. Archived history remains readable.
- Agenda, supplies and expense selectors use active IDs without renumbering.
- Each procedure can be individual (100%, no partner costs or repasse) or split between two selected professionals. This does not implement a split among three or more participants in one procedure.
- New records preserve participant IDs and names, including ownership of consumed materials. The server prevents invalid, duplicate, out-of-range, inactive or reassigned historical participants, and validates per-participant consumable costs.
- Monthly financial totals and CSV include the actual participants; removed professionals only show historical totals where they participated.
- Team removal does not revoke an account's clinic membership. Account access remains a separate control in Clinic and access, protected by MFA.

## Validation

- Applied migration: `20261028185829_clinic_professional_roster`.
- 59 SQL assertions passed after applying the migration (40 prior isolation/auth/business checks plus 19 roster checks); fictional accounts and clinical fixtures rolled back.
- The existing clinic snapshot passed current validation; it was not modified.
- Node regression tests: account navigation, team IDs/archival, script action allowlist/CSP and static deployment file allowlist passed.
- Browser QA with a simulated API: added a third professional, archived another, selected the third professional for an individual R$1,000 attendance, saved it, and verified R$1,000 attributed to the correct person with no repasse. The browser-generated snapshot passed the SQL validator.
- Supabase advisors: five INFO deny-by-default private tables remain intentional. A WARN reports disabled leaked-password protection; this Auth setting remains pending and is not fixed by roster changes.

## Brand and boundaries

Pellum is the provisional working name, inspired by the user's Pelle direction. Exact-name software searches returned no matching product at review time; this does not establish trademark, domain or social-handle availability. Existing green `#345e4d`, cream and gold are preserved; wordmark and P favicon updated only in the independent build. Auth/storage keys and Supabase identifiers stay stable. The legacy hosted Site is unchanged.

SMTP, real-device auth/TOTP, offsite disaster recovery and other remaining review items still block real patient data. No credentials or patient data are included in this document.

## Recovery

Use a forward fix and preserve current snapshots/history. After records with non-default professional IDs exist, do not restore the old validator or publish a UI that assumes all attendances belong to slots 0/1. The admin-link-only fix remains in GitHub for separate review. No table or clinical data was deleted by this migration.
