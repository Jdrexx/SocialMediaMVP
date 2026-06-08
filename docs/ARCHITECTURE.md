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
| Auth | `src/features/auth/routes.js` | `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/session` |
| Users | `src/features/users/routes.js` | `/api/me`, `/api/users/:username`, `/api/users/:username/follow` |
| Posts | `src/features/posts/routes.js` | `/api/posts`, `/api/feed`, `/api/posts/:id/like`, `/api/posts/:id/comments` |
