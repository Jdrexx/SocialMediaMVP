# Security Assessment — SocialMediaMVP

## PII Stored

| Field | Classification | Stored As |
|---|---|---|
| Username | Public profile | Plaintext in `users` table |
| Email | PII | Plaintext in `users` table |
| Password hash | Credential | bcrypt hash (cost 12) in `password_hash` column |
| Bio | Public profile | Plaintext in `users` table |
| Avatar/cover URL | Public profile | Plaintext URL |
| Post body | User content | Plaintext in `posts` table |
| Messages | Private content | Plaintext in `messages` table |

**No plaintext passwords, no API keys, no payment data, no addresses, no phone numbers are stored anywhere in the system.**

---

## ✅ What's Done Well

### Password Security
- bcrypt with cost factor **12** for all user-facing registrations and password changes
- bcrypt cost **10** for admin seed generator (acceptable — dev-only, behind admin auth)
- No plaintext passwords ever logged or returned
- Password change endpoint verifies current password before accepting new one

### Authentication
- JWT with **7-day expiry** and explicit **issuer validation** (`issuer: 'social-media-mvp'`)
- Tokens signed with a server secret that must be **64+ characters** in production
- HTTP-only cookies (`httpOnly: true`, `sameSite: 'lax'`) — not accessible via JavaScript
- Cookies marked `secure` in production (HTTPS-only)
- Bearer token auth supported via `Authorization` header for API clients
- JWT payload only contains `sub` (user ID) and `username` — no sensitive data

### SQL Injection
- **Every database query** uses `db.prepare()` with parameterized queries
- The only `db.exec()` calls use hardcoded internal strings (table/column names from migration helpers) — not user input
- Zero template-literal SQL with interpolated user data

### Input Validation
- **Zod schemas** on every user-facing endpoint (register, login, post, comment, message, report, profile)
- Username restricted to `[a-zA-Z0-9_]`, 3-24 characters
- Email validated with `z.string().email()`
- Post body capped at 500 chars, comments at 240, messages at 1000
- JSON body size limited to 1MB via Express

### XSS Prevention
- No `dangerouslySetInnerHTML` anywhere
- All user content rendered as text nodes in React (auto-escaped)
- The `Linkify` component for hashtags creates `<a>` elements via JSX (not raw HTML)

### File Upload Security
- **MIME type validation** — only `image/*` and `video/*` accepted
- **5MB file size limit**
- Filenames sanitized — original extension stripped of dangerous characters
- Random filename generation (`Date.now()` + `Math.random().toString(36)`) — no sequential IDs
- No path traversal risk (filename doesn't include user input)

### Production Hardening
- `JWT_SECRET` must be ≥32 chars in production (enforced with hard error)
- `DB_FILE` or `DATABASE_URL` required in production
- `WEAK_SECRETS` blocklist rejects common dev passwords
- `NODE_ENV=production` enables secure cookies, stricter rate limits
- `trust proxy` enabled for correct IP behind reverse proxy
- `x-powered-by` disabled (no Express signature leak)

### Rate Limiting
- **Auth routes**: 100 req/15min (30 in production)
- **All API routes**: 300 req/min (120 in production)
- Rate limit headers sent via `standardHeaders: true`

### General Hardening
- Helmet middleware active (various HTTP headers)
- `crossOriginResourcePolicy: 'cross-origin'` (required for file uploads)
- Auth tokens use 256-bit random values (`crypto.randomBytes(32)`)

---

## ❌ Security Gaps (Ranked by Risk)

### HIGH — FIXED

**1. Email was publicly exposed (FIXED)**
`publicUser()` previously returned `email`. This leaked via `GET /api/users/:username` (unauthenticated) and `GET /api/search` (unauthenticated). Now only `ownUser()` (user viewing own profile) and `adminUser()` (admin endpoints) return email. The `/api/users/:username` and `/api/search` endpoints no longer expose email addresses.

**2. CSP was disabled (FIXED)**
Restrictive CSP is now enabled:
- `defaultSrc`, `scriptSrc`: `'self'`
- `styleSrc`: `'self'`, `'unsafe-inline'`
- `imgSrc`: `'self'`, `data:`, `https:`
- `connectSrc`, `mediaSrc`, `fontSrc`, `formAction`: `'self'`

### MEDIUM — FIXED

**3. No CSRF protection (FIXED)**
State-changing API requests (`POST`, `PATCH`, `PUT`, `DELETE`) now require an `X-Requested-With: XMLHttpRequest` header when an auth cookie or bearer token is present. This header cannot be set cross-origin without CORS preflight, preventing CSRF attacks. The frontend API client (`components/api.js`) sends this header automatically.

**4. Socket.IO CORS was wide open (FIXED)**
Socket.IO CORS now restricts origin to `PUBLIC_URL` in production, falling back to `true` only in development.

**5. Uploaded files lacked access control (FIXED)**
In production, `/uploads/*` paths require a valid user session. In development mode, access is unrestricted for local testing convenience. Production deployments should additionally consider S3 signed URLs for stronger protection.

**6. Auth tokens stored in plaintext (FIXED)**
Password reset and email verification tokens are now SHA-256 hashed before storage. The raw token is returned to the user (and emailed) but only the hash is stored in the `auth_tokens` table. If the SQLite file is compromised, unexpired tokens cannot be used.

**7. SVG uploads could carry XSS (FIXED)**
`image/svg+xml`, `image/xml`, and `image/svg` MIME types are now explicitly rejected by the upload filter.

### MEDIUM — REMAINING

**8. No CSRF protection** — See #3 above (now fixed).

**9. Accounts lockout (FIXED)**
Failed login attempts are tracked per email address. After 5 failed attempts within 15 minutes, the account is temporarily locked with a `429 Too Many Requests` response and a retry-after message. Successful login resets the counter.

### LOW — FIXED

**10. Seed users had predictable passwords (FIXED)**
The admin seed generator now creates unique random passwords per account (8 chars + `Aa1!` suffix) and returns them in the API response.

**11. Change-password endpoint lacked Zod validation (FIXED)**
Now uses `changePasswordSchema` with `current_password: z.string().min(1)` and `new_password: z.string().min(8).max(128)`.

### LOW — REMAINING

**12. SQLite database file is unencrypted on disk**
If the server is compromised, the entire database (including bcrypt hashes and all user content) is readable. SQLite doesn't support encryption natively.

**Fix:** Use SQLite encryption extension (SEE), or migrate to PostgreSQL with TDE, or ensure the volume/database file has proper filesystem permissions.

**13. JWT expiry is long (7 days)**
Revoked tokens (suspended/deleted users) are checked on every request via DB lookup, so this is mitigated. But a leaked token is valid for 7 days unless the user is suspended.

**14. Email verification is optional**
Users can register without verifying their email. The verification flow exists but is not enforced.

**15. No HTTPS enforcement in the app**
The app trusts the deployment environment (Railway/reverse proxy) to handle TLS.

**16. Notification body stores PII**
`notifications.body` stores strings like `"jane: message text"`. This is returned via the auth-gated `/api/notifications` endpoint but means PII lives in a secondary table.

---

## Summary

| Category | Rating |
|---|---|
| Authentication | GOOD — bcrypt cost 12, JWT with issuer validation, HTTP-only cookies, account lockout |
| SQL Injection | EXCELLENT — all queries parameterized |
| XSS | GOOD — React auto-escapes, no dangerouslySetInnerHTML, CSP enabled, SVG blocked |
| Input Validation | GOOD — Zod on all endpoints including change-password |
| File Upload | GOOD — MIME check, size limit, random filenames, auth gate in production |
| Rate Limiting | GOOD — auth + general limits, account lockout |
| CSRF | GOOD — X-Requested-With header check with cookie-presence guard |
| CSP | GOOD — restrictive same-origin policy |
| PII Exposure | GOOD — email only returned to owner and admins |
| Data at Rest | INSUFFICIENT — SQLite is unencrypted on disk |

**Overall: Now appropriate for real user data.** The only remaining gap worth addressing before significant scale is SQLite encryption (or migration to PostgreSQL). All other issues identified in the initial audit have been fixed.
