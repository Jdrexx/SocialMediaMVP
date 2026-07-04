## Still needed for employer-ready

| Item | Status | Effort |
|---|---|---|
| Admin backend (WordPress-like) | NOT DONE | Requires new routes + UI |
| Pagination on posts/search | NOT DONE | ~30 min |
| CI badge visible on GitHub | DONE | — |
| Screenshot in repo | DONE | — |
| Legacy frontend cleaned up | DONE | — |
| Component split | DONE | — |
| Dockerfile | NOT DONE | ~1 hr |
| TypeScript migration | NOT DONE | Big lift |

## Proposed admin panel — scope

A proper admin dashboard with full CRUD over the platform, accessible to admin users at `/admin`:

**Backend (new routes in `src/features/moderation/routes.js`):**
- `GET /api/admin/stats` — counts (users, posts, reports, active today)
- `GET /api/admin/posts` — all posts including hidden, filterable
- `PATCH /api/admin/users/:id` — edit user (admin role, username, unsuspend)
- `POST /api/admin/reports/:id/resolve` — mark report resolved
- `POST /api/admin/reports/:id/dismiss` — dismiss report

**Frontend (`/admin` page):**
- Stats cards (users, posts, reports, signups)
- Users table: search, filter, suspend/unsuspend, promote/demote admin
- Posts table: view all, hide/unhide, delete
- Reports queue: review, resolve, dismiss
- Quick actions sidebar
- Only accessible to admin users; non-admins see 404

**Total new code:** ~200 lines backend + ~300 lines frontend
