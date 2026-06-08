# Social Media MVP

A working full-stack social media MVP with:

- Email/password auth with HTTP-only JWT cookie sessions
- Profiles with bio and avatar URL
- Posts with optional image URL
- Likes/unlikes
- Comments
- Follow/unfollow
- Authenticated personal feed plus public feed
- SQLite persistence
- API tests

## Run locally

```bash
npm install
npm start
```

Open: http://localhost:3000

## Test

```bash
npm test
```

## API overview

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
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
