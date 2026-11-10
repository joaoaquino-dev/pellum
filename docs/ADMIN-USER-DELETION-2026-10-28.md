# Administrative account deletion

Implemented `delete_user` inside the existing private admin RPC. No new public SECURITY DEFINER function, privileged frontend key or Edge Function was introduced. Public invoker/grants remain unchanged.

## Contract

- Requires current confirmed administrator identity, a live session, verified MFA and aal2, plus the existing administrative request quota.
- The UI shows an irreversible-deletion dialog and requires typing the selected account email. The server independently checks confirmation and the exact Auth user ID from the prior list, protecting against deleting a different account recreated with the same email.
- Self-deletion and enabled platform administrators are blocked.
- Accounts responsible for clinics or owning Storage objects are blocked. Responsibility transfer is not implemented in this UI; resolve it separately before deletion. No clinic ownership is reassigned automatically.
- For eligible accounts, one database transaction removes clinic memberships, sessions, idempotency/rate-limit rows, the Auth user, the license and any disabled admin entry. Auth identity/MFA/session dependencies use the existing inspected cascades. Unknown restrictive dependencies cause the transaction to fail rather than removing clinical data.
- Records, clinic snapshots, stock, financial history and protected platform audit stay intact. This is account removal, not a patient-data erasure or comprehensive LGPD deletion flow.
- The audit retains target email, deleted user ID and removed-membership count; no password, token or clinical payload is recorded.
- The list now includes existing Auth accounts even when they have not generated a license row, plus preauthorized email entries. List access remains administrative with MFA, limited to 200 entries as before.

## Evidence

- Applied migration: `20261028195618_platform_user_deletion`.
- 90 rollback-only SQL assertions passed after application: prior isolation/auth/financial/catalog tests plus denied ordinary user, insufficient MFA, wrong confirmation, stale target ID, self/admin protection, clinic-owner and file-owner guards; eligible deletion; user/session/MFA/license/membership removal; audit; unchanged fictional clinics; old session denied and repeated deletion rejected.
- All test accounts, sessions, clinics, bucket and object fixtures rolled back. No real account was deleted.
- Browser UI test used a simulated API: protected row disabled, wrong confirmation sends no request, correct confirmation submits the exact selected email and UUID and removes that fictitious row.
- Static build and syntax, account navigation, team model, action/CSP and deployment-output checks passed. Existing security-advisor limitations remain separately documented.

Supabase documents direct Auth-user deletion and the outstanding-access-token caveat at https://supabase.com/docs/guides/auth/managing-user-data . Pellum closes its clinical/RPC access window by checking the live Auth user and session on protected operations.

## Recovery

Deploying the function and UI does not delete existing accounts. A completed account deletion cannot be undone from the normal panel; recreation requires fresh signup, approval and clinic membership. Preserved clinical history does not restore credentials or MFA. If the feature must be disabled, revert the UI/RPC change without altering clinic data or audit records.
