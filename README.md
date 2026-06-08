# Social Media MVP

A working full-stack social media MVP built to be easy to upgrade.

## Features

- Email/password auth with HTTP-only JWT cookie sessions
- Profiles with bio and avatar URL
- Posts with optional image URL
- Likes/unlikes
- Comments
- Follow/unfollow
- Authenticated personal feed plus public feed
- SQLite persistence
- Modular backend feature folders
- API tests
- Feature scaffolding helper

## Run locally

```bash
npm install
npm start
```

Open: http://localhost:3000

On Windows, you can also double-click:

```text
run-social-mvp.bat
```

## Test

```bash
npm test
```

## Upgrade-friendly structure

```text
src/
  app.js                  # Small Express setup and feature registration
  db.js                   # Database schema/migrations
  server.js               # Server entrypoint
  features/
    index.js              # Feature registry
    auth/routes.js        # Auth routes
    users/routes.js       # Profile/follow routes
    posts/routes.js       # Feed/post/like/comment routes
  lib/
    auth.js               # Shared auth/session helpers
    http.js               # Shared middleware
    posts.js              # Shared post query/serialization helpers
    schemas.js            # Shared request validation schemas
```

Detailed docs:

- [Architecture](docs/ARCHITECTURE.md)
- [Adding Features Guide](docs/ADDING_FEATURES.md)

## Add a new feature

Create a feature route stub:

```bash
npm run scaffold:feature messages
```

Then:

1. Register it in `src/features/index.js`.
2. Add tests in `tests/`.
3. Add database tables/indexes in `src/db.js` if needed.
4. Implement routes in `src/features/messages/routes.js`.
5. Run `npm test`.

## API overview

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`
- `GET /api/me`
- `PATCH /api/me`
- `GET /api/users/:username`
- `POST /api/users/:username/follow`
- `GET /api/posts`
- `GET /api/feed`
- `POST /api/posts`
- `DELETE /api/posts/:id`
- `POST /api/posts/:id/like`
- `POST /api/posts/:id/comments`

## Production notes

This is an MVP, not production-ready. Next upgrades should include HTTPS-only cookies, strong `JWT_SECRET`, media uploads, moderation/reporting, notification system, password reset, email verification, database backups, observability, and deployment hardening.
