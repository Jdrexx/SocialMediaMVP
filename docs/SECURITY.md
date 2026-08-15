# MySazz Security and Privacy Status

This is an implementation status document, not a certification. MySazz handles lived-experience, approximate-location, relationship, and private-message data. Treat the repository as a pre-production foundation until an independent security/privacy review, deployment review, and legal review are complete.

## Data inventory

| Data | Storage | Exposure |
|---|---|---|
| Email | Plaintext database field | Account owner and admins |
| Password | bcrypt cost-12 hash | Never returned by the API |
| TOTP secret | AES-256-GCM application encryption | Server-side authentication flow |
| Private messages | AES-256-GCM application encryption | The two connected members; server can decrypt |
| Lived-experience tags | Plaintext database field | Hidden from members unless the owner opts in; server/admin storage still contains them |
| Relationship status | Plaintext database field | Hidden from members unless the owner opts in |
| ZIP/postal code | Plaintext database field | Account owner/API internals only |
| City/region | Plaintext database field | Visible to authenticated members for discoverable profiles |
| Posts/comments | Plaintext database fields | Authenticated members, subject to block/moderation rules |
| Media | Private filesystem path | Authenticated `/uploads` route; possession of a URL is not per-recipient authorization |
| Consent records | Versioned database rows | Account owner export and server/admin storage |

Message and TOTP encryption is **not end-to-end encryption**. The application holds `DATA_ENCRYPTION_KEY` and can decrypt those records. Back up this key separately; losing it makes encrypted data unreadable.

## Implemented controls

- HTTP-only, SameSite JWT cookies; secure cookies in production; suspended/deleted users are checked on each authenticated request.
- Production refuses weak/missing JWT and data-encryption keys and requires a persistent database configuration.
- Email verification gates member features in production; administrator bootstrap is restricted to configured `ADMIN_EMAILS`.
- Authenticator-app TOTP with encrypted secret storage and password-plus-code disable flow.
- bcrypt cost 12 for member passwords; hashed, expiring reset and email-verification tokens.
- Route and login-attempt rate limits. Login errors do not reveal whether an email exists.
- Parameterized SQL throughout user-facing query paths and Zod request validation.
- Helmet/CSP headers, React escaping, no `dangerouslySetInnerHTML`, and SVG upload rejection.
- State-changing authenticated API requests require `X-Requested-With`; browsers cannot add it cross-origin without a successful CORS preflight.
- Member stories, profiles, search, media, messaging, and calls require authentication/onboarding; production also requires verified email.
- Mutual acceptance gates messages and video signaling. Blocks propagate through discovery, feed actions, connections, messages, and calls.
- Media is stored outside the Next.js public directory and served through an authenticated route.
- Private-message notification previews do not contain message text.
- User data export and password-confirmed permanent account deletion are available.
- Reports cover posts, members, and messages; admin actions are recorded in an activity log.

## Required before a sensitive-data production launch

1. Commission an independent application/API security review and privacy threat model. Include authorization tests for every object reference, Socket.IO events, media URLs, admin routes, exports, and deletion.
2. Use managed PostgreSQL or encrypted persistent volumes/backups, least-privilege database credentials, key rotation, restore drills, and a documented retention schedule. Profile/post content is not application-encrypted.
3. Move media to private object storage with short-lived signed URLs, content-signature validation, image/video re-encoding, malware scanning, and per-object authorization. The current MIME check trusts upload metadata.
4. Replace in-process login lockout/rate state with a shared store before horizontal scaling. Add session/version revocation so password resets and security changes invalidate existing sessions.
5. Configure and test SMTP, TURN, backups, monitoring, centralized redacted logs, alerting, dependency scanning, incident response, abuse escalation, and moderator coverage.
6. Have counsel/privacy specialists review eligibility attestation, confidentiality language, Terms, Privacy Policy, deletion/retention, mandatory-reporting implications, accessibility, nonprofit/member-payment rules, and relevant state privacy laws.
7. Complete the Resource Navigator safety gates in [`AI_RESOURCE_NAVIGATOR.md`](AI_RESOURCE_NAVIGATOR.md). No generated or scraped resource should be presented without provenance and freshness controls.

## Known limitations

- The server can decrypt messages; there is no end-to-end key agreement, member key verification, or encrypted attachment layer.
- ZIP, experience tags, relationship state, posts, and comments are plaintext at the application/database layer.
- Authenticated media access is platform-wide, not limited to a connection or conversation.
- Account lockout is process-local and resets on restart.
- JWT sessions last seven days and are not currently invalidated by password reset/change.
- Email addresses and usernames can still be inferred through registration-conflict responses.
- PostgreSQL support exists in the data wrapper but needs live integration, migration, concurrency, backup, and rollback validation before production use.
- WebRTC uses peer-to-peer media, but signaling metadata passes through the server; production reliability needs TURN and an explicit metadata/retention policy.
- The policy pages are product drafts, not legal advice or reviewed legal instruments.

## Launch assessment

The code now has substantially stronger privacy and abuse-prevention defaults than the original social MVP, but it should not yet be described as certified, compliant, or production-safe for sensitive mental-health data. Promote it to real-user production only after the launch requirements above are closed and documented.
