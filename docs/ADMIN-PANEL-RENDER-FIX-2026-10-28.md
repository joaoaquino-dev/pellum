# Admin panel rendering and deletion feedback

## Findings

Multiple asynchronous initial route calls could append complete admin sections to the same page. Each used document-wide ID/button selectors, so duplicate IDs and stale data closures could attach actions to the wrong copy. Scrolling exposed these repeated sections. Clinic synchronization could also reroute the administrative page unnecessarily.

The current real accounts were all clinic owners at inspection time, so the deletion ownership guard disabled their buttons. No eligible real account or actual deletion failure was established. The guard remains in the database.

## Fix

- Single connected admin root; concurrent calls coalesce into one request.
- Root-scoped forms and action bindings; refresh replaces content rather than appending duplicate IDs.
- Responses for disconnected or superseded roots are discarded after async authentication/list fetch.
- Clinic polling skips admin, help and initial setup views.
- Protected deletion buttons open an explicit explanation instead of an inert disabled action. Eligible account deletion still requires typed email confirmation; server authorization and ownership checks remain unchanged.

## Verification

- `tests/panel-renderer.mjs`: concurrent calls, refresh reuse, obsolete response and navigation-away cases passed.
- Browser fixture using the actual admin component and a simulated API: four concurrent entries caused one root, one list request and one form; scrolling preserved the counts; owner-account warning displayed; eligible deletion sent the exact target UUID/email and left one form after refresh.
- Account navigation, team model, build/syntax, script actions/CSP and static-output allowlist passed. No SQL authorization changes were made.

No real account, clinic or record was deleted or reassigned. The requested email reset remains blocked by existing clinic ownership until its destination is explicitly authorized. Personalized transactional email templates are prepared in GitHub but SMTP/domain setup is still pending.
