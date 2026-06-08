# Social Media MVP

A working full-stack social media MVP built to be easy to upgrade.

## Features

- Email/password auth with HTTP-only JWT cookie sessions
- Password reset token flow
- Email verification token flow
- Profiles with bio and avatar URL
- Posts with uploaded image/video media or fallback image URL
- Likes/unlikes
- Comments
- Follow/unfollow
- Notifications for likes, comments, follows, and messages
- User/post search
- Report posts
- Admin/moderation dashboard APIs and UI section
- Real-time-ready chat/messages with an SSE stream endpoint
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
  app.js                         # Small Express setup and feature registration
  db.js                          # Database schema/migrations
  server.js                      # Server entrypoint
  features/
    index.js                     # Feature registry
    auth/routes.js               # Auth, reset, email verification
    uploads/routes.js            # Media uploads
    users/routes.js              # Profile/follow routes
    posts/routes.js              # Feed/post/like/comment routes
    notifications/routes.js      # Notifications
    search/routes.js             # User/post search
    moderation/routes.js         # Reports and admin moderation
    messages/routes.js           # Chat/messages and SSE stream
  lib/
    auth.js                      # Shared auth/session helpers
    http.js                      # Shared middleware
    notifications.js             # Notification helper
    posts.js                     # Shared post query/serialization helpers
    schemas.js                   # Shared request validation schemas
```

Detailed docs:

- [Architecture](docs/ARCHITECTURE.md)
- [Adding Features Guide](docs/ADDING_FEATURES.md)

## Add a new feature

Create a feature route stub:

```bash
npm run scaffold:feature bookmarks
```

Then:

1. Register it in `src/features/index.js`.
2. Add tests in `tests/`.
3. Add database tables/indexes in `src/db.js` if needed.
4. Implement routes in `src/features/bookmarks/routes.js`.
5. Run `npm test`.

## API overview

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`
- `POST /api/auth/password-reset/request`
- `POST /api/auth/password-reset/confirm`
- `POST /api/auth/email-verification/request`
- `POST /api/auth/email-verification/confirm`

### Users/posts/feed

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

### New feature APIs

- `POST /api/uploads`
- `GET /api/notifications`
- `POST /api/notifications/:id/read`
- `POST /api/notifications/read-all`
- `GET /api/search?q=term`
- `POST /api/reports/posts/:id`
- `GET /api/admin/reports`
- `GET /api/admin/users`
- `DELETE /api/admin/posts/:id`
- `POST /api/admin/users/:id/suspend`
- `GET /api/messages/threads`
- `GET /api/messages/stream`
- `GET /api/messages/:username`
- `POST /api/messages/:username`

## MVP notes

The password reset and email verification features return `dev_token` in API responses for local MVP testing. In production, send those tokens by email and remove token display from the UI/API response.

The first registered user becomes an admin. In production, manage admins through a secure admin table or environment-controlled bootstrap process.

The chat feature includes an SSE stream endpoint so real-time clients have a clean upgrade path. For high-scale production chat, upgrade to Socket.IO/WebSockets or a managed realtime service.

## Production hardening checklist

- HTTPS-only secure cookies
- Strong `JWT_SECRET` via `.env`
- Real email sending for reset/verification tokens
- Cloud/object storage for uploads
- Virus scanning/media moderation
- PostgreSQL instead of SQLite
- Pagination/infinite scroll
- Stronger admin audit logs
- WebSocket-backed chat presence/typing indicators
- Database backups
- Observability/logging
- CI/CD deployment pipeline
