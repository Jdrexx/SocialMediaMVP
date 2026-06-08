# Social Media MVP Architecture

## Goal

Keep the MVP easy to upgrade by separating app startup, shared libraries, feature routes, and tests.

## Request lifecycle

1. `src/server.js` opens the SQLite database and starts the HTTP server.
2. `src/app.js` creates the Express app, installs middleware, loads the current user, and registers all features.
3. `src/features/index.js` loops through the feature registry and mounts each feature router.
4. Feature route files handle API requests and use shared helpers from `src/lib`.
5. `src/db.js` owns schema creation and migrations.

## Dependency flow

```text
server.js
  -> db.js
  -> app.js
       -> features/index.js
            -> features/*/routes.js
       -> lib/*.js
```

Rules:

- Feature route files can import from `src/lib`.
- `src/lib` files should not import from feature folders.
- `src/app.js` should stay small; do not add route logic directly there.
- Database schema changes belong in `src/db.js`.
- New API behavior needs automated tests in `tests/`.

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
  jwtSecret
}
```

Add more shared dependencies to `context` only when needed.

## Current features

| Feature | File | Routes |
| --- | --- | --- |
| Auth | `src/features/auth/routes.js` | Register, login, logout, reset password, verify email |
| Uploads | `src/features/uploads/routes.js` | Upload image/video media |
| Users | `src/features/users/routes.js` | `/api/me`, profiles, follows |
| Posts | `src/features/posts/routes.js` | Public feed, personal feed, posts, likes, comments |
| Notifications | `src/features/notifications/routes.js` | List/read notifications |
| Search | `src/features/search/routes.js` | User and post search |
| Moderation | `src/features/moderation/routes.js` | Reports, admin reports/users/post hiding/user suspension |
| Messages | `src/features/messages/routes.js` | Threads, direct messages, SSE stream |

## Upgrade notes

- Uploads currently save to `public/uploads`. Upgrade to S3/R2/Azure Blob for production.
- Password reset/email verification currently expose `dev_token` for MVP testing. Upgrade to email delivery.
- Chat uses an SSE stream endpoint as a real-time foundation. Upgrade to Socket.IO/WebSockets for typing indicators and presence.
- Admin is bootstrapped by making the first registered user an admin. Upgrade to explicit role management.
