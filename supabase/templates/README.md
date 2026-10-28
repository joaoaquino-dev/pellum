# Pellum transactional emails — prepared, not activated

Current verified state (2026-10-28): custom SMTP is OFF. The Supabase dashboard says custom SMTP is required to edit template subjects and bodies. These source templates have not been applied to the provider and no delivery has been validated.

| Template | Subject | Source |
| --- | --- | --- |
| Confirm sign up | Confirme seu e-mail na Pellum | confirmation.html |
| Reset password | Redefina sua senha na Pellum | recovery.html |

Set the sender display name to Pellum after configuring a sender authorized by the domain owner. Do not invent or use an unverified From address. Domain/provider selection, DNS ownership validation (SPF/DKIM/DMARC as instructed by the provider), SMTP host/port and secret entry remain pending. Never commit credentials or paste them into chat.

Both templates keep Supabase's server-generated {{ .ConfirmationURL }} variable, no user_metadata, no tracking or external assets. Confirming email does not grant a license or clinic membership. PKCE recovery should be opened in the browser that requested it.

The confirmation URL can still use the Supabase project hostname after custom SMTP is enabled. A custom Auth domain is a separate optional configuration; do not claim the provider URL disappears just from changing email copy or the sender. Keep the exact existing redirect allowlist until an owned application domain has been validated.

Before enabling general signup: verify actual delivery to authorized test recipients, Portuguese subject/body/sender, confirmation return, expired or reused links, pending-license state and password reset on the real deployed site. Keep confirmation and MFA enabled.

Official references:
- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/docs/guides/auth/auth-email-templates
- https://supabase.com/docs/guides/auth/sessions/pkce-flow
