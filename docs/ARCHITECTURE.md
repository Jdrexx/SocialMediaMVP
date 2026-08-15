# MySazz Community Architecture

## Goal

Keep the MVP easy to upgrade by separating app startup, realtime wiring, shared libraries, feature routes, tests, and the React/Next.js frontend.

## Request lifecycle

1. `src/server.ts` reads runtime config, opens the database, creates an HTTP server, attaches Socket.IO, and starts listening.
2. `src/app.ts` creates the Express app, installs middleware, loads the current user, creates the email service, and registers all features.
3. `src/features/index.ts` loops through the feature registry and mounts each feature router.
4. Feature route files handle API requests and use shared helpers from `src/lib`.
5. `src/db.ts` owns schema creation and lightweight migrations.
6. `app/` contains the Next.js frontend, which calls the Express API and Socket.IO server.

## Dependency flow

```text
server.ts
  -> lib/env.ts
  -> db.ts
  -> app.ts
  -> lib/realtime.ts
       -> lib/auth.ts
app.ts
  -> lib/email.ts
  -> features/index.ts
       -> features/*/routes.ts
  -> lib/*.ts
app/ Next.js frontend
  -> /api/* HTTP calls
  -> Socket.IO client
```

Rules:

- Feature route files can import from `src/lib`.
- `src/lib` files should not import from feature folders.
- `src/app.ts` should stay small; do not add route logic directly there.
- Database schema changes belong in `src/db.ts` until versioned migrations are introduced.
- New API behavior needs automated tests in `tests/`.
- New UI behavior should keep the mobile-first layout in `app/globals.css` intact.

## Feature registry contract

Each registry entry has this shape:

```js
{
  name: 'posts',
  mountPath: '/api',
  createRouter: createPostsRouter
}
```

`createRouter(context)` receives:

```js
{
  db,
  jwtSecret,
  config,
  email,
  io
}
```

Add more shared dependencies to `context` only when needed.

## Current features

| Feature | File | Routes |
| --- | --- | --- |
| Auth | `src/features/auth/routes.ts` | Register, login, logout, reset password, email verification, TOTP |
| Uploads | `src/features/uploads/routes.ts` | Authenticated image/video media upload |
| Users | `src/features/users/routes.ts` | `/api/me`, privacy profile, avatar/cover, follows, export/delete |
| Connections | `src/features/connections/routes.ts` | Mutual connection requests, acceptance, decline, removal, and status |
| Posts | `src/features/posts/routes.ts` | Member feed, personal feed, posts, likes, comments |
| Notifications | `src/features/notifications/routes.ts` | List/read notifications |
| Search | `src/features/search/routes.ts` | Privacy-aware member and post search |
| Moderation | `src/features/moderation/routes.ts` | Reports, admin reports/users/post hiding/user suspension |
| Messages | `src/features/messages/routes.ts` | Connection-gated encrypted messages, threads, SSE compatibility, Socket.IO emits |
| Video calls | `src/lib/realtime.ts` + `app/page.tsx` | Connection-gated Socket.IO signaling for call invite/accept/reject/end plus WebRTC offer/answer/ICE relay |
| Frontend | `app/page.tsx` | Next.js dashboard UI for onboarding, profiles, posts, connections, notifications, chat, and video calls |

## Production notes

- `src/lib/env.js` rejects weak production config before the server starts.
- Cookies become secure in production.
- SMTP is real when `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASS` are set.
- Uploads save outside the web root in `UPLOAD_DIR` and are served through an authenticated route; upgrade to signed S3/R2/UploadThing URLs for larger multi-instance deployments.
- SQLite is acceptable for a single-instance MVP with persistent disk. Multi-instance production should migrate to PostgreSQL and an ORM/query layer.
- Socket.IO powers realtime chat and typing; add Redis adapter before multi-instance horizontal scaling.
- WebRTC handles peer-to-peer video/audio streams; Socket.IO only relays call signaling. Add TURN credentials for reliable production calls behind restrictive networks.
- Production admins are explicitly bootstrapped through `ADMIN_EMAILS`; first-user admin is limited to development/test.
- Authenticated member media is served behind session checks. Move uploads to private object storage with signed URLs before multi-instance deployment.
- `DATA_ENCRYPTION_KEY` protects message content at rest and must be managed independently from `JWT_SECRET`.
