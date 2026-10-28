> **Antes de usar dados reais:** leia [a revisão de segurança](security/REVIEW-2026-10-28.md). A nova versão não foi publicada nem aprovada para dados reais. A árvore antiga tem alertas de dependências e não deve ser republicada.

# Aura · Gestão estética

Private beta for clinic scheduling, product costs, stock, patient contacts and partnership accounting.

## Identity and tenancy

The hosting platform owns sign-in with ChatGPT. Every API request requires authenticated identity. Access to clinic data is checked against clinic membership on the server; site visitor access is an additional hosting boundary. The initial owner can authorize/revoke editors by email. Never make the site public as a workaround for visitor access.

Clinic data starts empty. Browser demonstration data is not silently imported. Records live in D1, with optimistic revision checks. A conflicting or failed save stops the client queue and offers an export before reload. Successful writes atomically retain the previous snapshot with actor and timestamp. Owner-only restoration creates another backup of the displaced state. Polling refreshes inactive views every 15 seconds; forms retain their current edit until saved or a conflict is reported.

## Current scope

Two professional shares per clinic; patient contacts and history; editable calendar appointments and linked returns; product lots, ownership, expiry, stock alerts and movements; consumption posts with financial records; configurable splits and product reimbursement; target-price calculation; WhatsApp draft budgets; payments, estimated monthly installment dates, transfers and expenses; CSV and JSON export.

Snapshots and backups are an initial persistence model with a 3 MB write limit. Stock corrections are explicit movements. Editing a financial material amount does not rewrite historical stock movements. Installment plans are schedules, not payment processing. There are no automated WhatsApp messages, billing provider, subscription plans or self-service public sales. Clinical documents/photos are not included.

Before commercial release: split the aggregate into indexed relational entities, define backup retention and external recovery, load-test concurrent tenants and mobile flows, establish observability/support, validate privacy/consent requirements and contractual terms, add billing/entitlements and explicit onboarding. Current checks do not establish commercial or regulatory readiness.

## Verification

`node --experimental-sqlite tests/access.cjs` tests unauthenticated access, clinic isolation, membership/revocation, CSRF origin, stale-write rejection, audit snapshots and restoration against SQLite.

`node --check public/aura/features.js` and `node --check public/aura/cloud.js` check browser code syntax. Build and deploy with the Sites workflow. D1 schema migrations live under `drizzle/` and are applied by hosting before deployment. Keep existing applied migrations immutable.
