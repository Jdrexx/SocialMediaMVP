## Remaining for employer-ready

| Item | Status | Effort |
|---|---|---|
| Admin dashboard | DONE | — |
| Pagination on posts/search | DONE | — |
| CI badge visible on GitHub | DONE | — |
| Screenshot in repo | DONE | — |
| Legacy frontend cleaned up | DONE | — |
| Component split | DONE | — |
| Dockerfile | DONE | — |
| Security hardening for real user PII | DONE | — |
| PostgreSQL migration | DONE | — |
| TypeScript migration | NOT DONE | Big lift |

## Security hardening priorities (see docs/SECURITY.md)

See `docs/SECURITY.md` for the full audit. All HIGH and MEDIUM priority issues have been fixed:

| Issue | Status | Fix |
|---|---|---|
| Email exposed on public endpoints | FIXED | Split into `publicUser` / `ownUser` / `adminUser` |
| CSP disabled | FIXED | Restrictive same-origin CSP enabled |
| No CSRF protection | FIXED | X-Requested-With header check + frontend sends it |
| Socket.IO CORS wide open | FIXED | Pins to PUBLIC_URL in production |
| Uploads no auth gate | FIXED | Auth required in production |
| Auth tokens plaintext in DB | FIXED | SHA-256 hashed before storage |
| SVG upload XSS vector | FIXED | SVG MIME types rejected |
| No account lockout | FIXED | 5 failed attempts locks for 15 min |
| Seed users weak passwords | FIXED | Random passwords generated per account |
| Change-password no validation | FIXED | Zod schema added |

Remaining (acceptable for MVP): SQLite encryption, JWT 7-day expiry, optional email verification, no HTTPS enforcement in app.
