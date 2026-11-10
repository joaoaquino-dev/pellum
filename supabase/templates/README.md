# Pellum transactional emails — active templates

Verified in the Supabase dashboard on 2026-10-29: custom SMTP is ON, relay `smtp-relay.brevo.com`, port 587, sender name Pellum. Sender `pellumgestaodeestetica@gmail.com` is active in the connected Brevo account, confirmed by its plugin. The SMTP secret was entered by the owner directly and was not read, retrieved or written to the repository.

Confirmation and recovery subjects and bodies were saved in the Supabase dashboard and checked in preview. Full-document replacement was verified to remove the old English template. This verifies saved configuration and visual rendering, not actual inbox delivery or an end-to-end recovery.

| Template | Subject | Source |
| --- | --- | --- |
| Confirm sign up | Confirme seu e-mail na Pellum | confirmation.html |
| Reset password | Redefina sua senha na Pellum | recovery.html |

The current sender uses Gmail and no owned domain has been configured. Brevo may replace the technical sender domain for deliverability; this is a temporary setup. A verified branded domain with provider-directed SPF/DKIM/DMARC remains the long-term configuration. Never commit credentials or paste them into chat.

Both templates keep Supabase's server-generated {{ .ConfirmationURL }} variable, no user_metadata, no tracking or external assets. Confirming email does not grant a license or clinic membership. PKCE recovery should be opened in the browser that requested it.

The confirmation URL can still use the Supabase project hostname after custom SMTP is enabled. A custom Auth domain is a separate optional configuration; do not claim the provider URL disappears just from changing email copy or the sender. Keep the exact existing redirect allowlist until an owned application domain has been validated.

Before enabling general signup: verify actual delivery to authorized test recipients, Portuguese subject/body/sender, confirmation return, expired or reused links, pending-license state and password reset on the real deployed site. Keep confirmation and MFA enabled. Send a real test only to an explicitly confirmed recipient.

Official references:
- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/docs/guides/auth/auth-email-templates
- https://supabase.com/docs/guides/auth/sessions/pkce-flow

