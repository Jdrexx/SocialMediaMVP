# Social Media MVP

A working full-stack social media platform MVP built to be easy to upgrade and deploy.

## Features

- Express API with modular feature folders
- React/Next.js frontend in the App Router
- Mobile-friendly responsive UI
- Email/password auth with HTTP-only JWT cookie sessions
- Production auth hardening: required strong `JWT_SECRET` in production, secure cookies, `trust proxy`, hidden Express signature, tighter auth rate limits
- Real SMTP email sending for password reset and email verification when SMTP variables are configured
- Local dev-token fallback for reset/verification while developing locally
- Profiles with bio, profile photo, and cover image
- Uploaded image/video media for posts
- Likes/unlikes
- Comments
- Follow/unfollow
- Notifications for likes, comments, follows, and messages
- User/post search
- Report posts
- Admin/moderation dashboard APIs
- Real-time chat delivery with Socket.IO
- WebRTC video chat between users using Socket.IO signaling
- Typing indicators over WebSockets
- SSE compatibility endpoint for older realtime clients
- Authenticated personal feed plus public feed
- SQLite persistence for local/dev, with production requiring a persistent `DB_FILE` volume before deploy
- API tests
- Feature scaffolding helper

## Run locally

Backend API/static legacy UI:

```bash
npm install
npm start
```

Open: http://localhost:3000

Next.js frontend:

```bash
npm run frontend:dev
```

Open: http://localhost:3001

The Next.js dev server proxies `/api/*` and `/uploads/*` to the Express backend at `http://localhost:3000`. Set `NEXT_PUBLIC_API_URL` if your API is elsewhere.

On Windows, you can also double-click:

```text
run-social-mvp.bat
```

## Test and build

```bash
npm test
npm run frontend:build
```

Current verification target: all API tests pass and the Next.js production build succeeds.

## Environment variables

```env
NODE_ENV=production
PUBLIC_URL=https://your-domain.com
JWT_SECRET=generate-a-64-character-random-secret
DB_FILE=/data/social.sqlite

SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=resend
SMTP_PASS=your-smtp-password
SMTP_FROM="Social Media MVP <no-reply@your-domain.com>"

NEXT_PUBLIC_API_URL=https://your-api-domain.com
```

Generate a strong secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Production startup will fail fast if `JWT_SECRET` is weak or if neither `DB_FILE` nor `DATABASE_URL` is set. The current runtime uses SQLite, so set `DB_FILE` to a persistent mounted volume on Railway/Fly/VPS. A managed PostgreSQL migration is still the recommended next step for high-scale production.

## Upgrade-friendly structure

```text
app/                             # Next.js frontend
  layout.jsx
  page.jsx
  globals.css
src/
  app.js                         # Small Express setup and feature registration
  db.js                          # SQLite schema/migrations
  server.js                      # HTTP + Socket.IO server entrypoint
  features/
    index.js                     # Feature registry
    auth/routes.js               # Auth, SMTP-backed reset, email verification
    uploads/routes.js            # Media uploads
    users/routes.js              # Profile/follow/avatar/cover routes
    posts/routes.js              # Feed/post/like/comment routes
    notifications/routes.js      # Notifications
    search/routes.js             # User/post search
    moderation/routes.js         # Reports and admin moderation
    messages/routes.js           # Chat/messages and SSE compatibility stream
  lib/
    auth.js                      # Shared auth/session helpers
    email.js                     # Nodemailer SMTP service
    env.js                       # Runtime config and production guards
    http.js                      # Shared middleware
    notifications.js             # Notification helper
    posts.js                     # Shared post query/serialization helpers
    realtime.js                  # Socket.IO setup and emit helpers
    schemas.js                   # Shared request validation schemas
```

Detailed docs:

- [Architecture](docs/ARCHITECTURE.md)
- [Adding Features Guide](docs/ADDING_FEATURES.md)
- [Deployment Readiness](docs/DEPLOYMENT_READY.md)

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
5. Run `npm test` and `npm run frontend:build`.

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
- `POST /api/me/avatar`
- `POST /api/me/cover`
- `GET /api/users/:username`
- `POST /api/users/:username/follow`
- `GET /api/posts`
- `GET /api/feed`
- `POST /api/posts`
- `DELETE /api/posts/:id`
- `POST /api/posts/:id/like`
- `POST /api/posts/:id/comments`

### Feature APIs

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

- If SMTP is configured, password reset and verification links are sent by email.
- If SMTP is not configured, the API returns `dev_token` for local development only.
- The first registered user becomes an admin.
- Socket.IO now powers realtime message delivery, typing events, and WebRTC video-call signaling.
- Local uploads and SQLite are fine for MVP demos; production should use persistent storage/backups, and a managed database migration when usage grows.
