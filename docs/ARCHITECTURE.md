# Social Media MVP Architecture

## Goal

Keep the MVP easy to upgrade by separating app startup, realtime wiring, shared libraries, feature routes, tests, and the React/Next.js frontend.

## Request lifecycle

1. `src/server.js` reads runtime config, opens the database, creates an HTTP server, attaches Socket.IO, and starts listening.
2. `src/app.js` creates the Express app, installs middleware, loads the current user, creates the email service, and registers all features.
3. `src/features/index.js` loops through the feature registry and mounts each feature router.
4. Feature route files handle API requests and use shared helpers from `src/lib`.
5. `src/db.js` owns schema creation and lightweight migrations.
6. `app/` contains the Next.js frontend, which calls the Express API and Socket.IO server.

## Dependency flow

```text
server.js
  -> lib/env.js
  -> db.js
  -> app.js
  -> lib/realtime.js
       -> lib/auth.js
app.js
  -> lib/email.js
  -> features/index.js
       -> features/*/routes.js
  -> lib/*.js
app/ Next.js frontend
  -> /api/* HTTP calls
  -> Socket.IO client
```

Rules:

- Feature route files can import from `src/lib`.
- `src/lib` files should not import from feature folders.
- `src/app.js` should stay small; do not add route logic directly there.
- Database schema changes belong in `src/db.js` until the PostgreSQL/ORM migration happens.
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
| Auth | `src/features/auth/routes.js` | Register, login, logout, reset password, verify email via SMTP/dev-token fallback |
| Uploads | `src/features/uploads/routes.js` | Upload image/video media |
| Users | `src/features/users/routes.js` | `/api/me`, profile, avatar, cover image, follows |
| Posts | `src/features/posts/routes.js` | Public feed, personal feed, posts, likes, comments |
| Notifications | `src/features/notifications/routes.js` | List/read notifications |
| Search | `src/features/search/routes.js` | User and post search |
| Moderation | `src/features/moderation/routes.js` | Reports, admin reports/users/post hiding/user suspension |
| Messages | `src/features/messages/routes.js` | Threads, direct messages, SSE compatibility stream, Socket.IO message emits |
| Frontend | `app/page.jsx` | Next.js dashboard UI for auth, profile media, posts, search, notifications, chat |

## Production notes

- `src/lib/env.js` rejects weak production config before the server starts.
- Cookies become secure in production.
- SMTP is real when `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASS` are set.
- Uploads currently save to `public/uploads`; upgrade to S3/R2/UploadThing for larger production use.
- SQLite is acceptable for a single-instance MVP with persistent disk. Multi-instance production should migrate to PostgreSQL and an ORM/query layer.
- Socket.IO powers realtime chat and typing; add Redis adapter before multi-instance horizontal scaling.
- Admin is bootstrapped by making the first registered user an admin. Upgrade to explicit role management before public launch.
