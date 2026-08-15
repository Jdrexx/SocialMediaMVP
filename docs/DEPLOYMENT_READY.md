# Deployment Readiness

This project is now closer to a production deploy, but still keeps the MVP-friendly SQLite/local-upload defaults for fast iteration.

## What changed before deployment

- Next.js frontend added under `app/`.
- SMTP-backed email sending added with Nodemailer.
- Password reset and email verification send real email when SMTP env vars are present.
- Profile photos and cover images can be set from authenticated image uploads.
- Socket.IO realtime server added for chat message delivery, typing indicators, and WebRTC video-call signaling.
- Production config validation added in `src/lib/env.js`.
- Auth hardening added: strong production `JWT_SECRET`, secure cookies in production, `trust proxy`, disabled Express signature, tighter auth rate limits.
- Tests added for profile images and production config guards.

## Local development

Terminal 1:

```bash
npm start
```

Terminal 2:

```bash
npm run frontend:dev
```

Open the Next.js frontend at:

```text
http://localhost:3001
```

## Production environment variables

Minimum production variables:

```env
NODE_ENV=production
PUBLIC_URL=https://your-domain.com
JWT_SECRET=<64-char-random-secret>
DATA_ENCRYPTION_KEY=<independent-64-char-hex-key>
DB_FILE=/data/social.sqlite
UPLOAD_DIR=/data/uploads
ADMIN_EMAILS=owner@your-domain.com
```

Email variables for real verification/reset messages:

```env
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=resend
SMTP_PASS=<your-password-or-api-key>
SMTP_FROM="MySazz <no-reply@your-domain.com>"
```

Next.js frontend variable:

```env
NEXT_PUBLIC_API_URL=https://your-api-domain.com
```

## Railway deployment recommendation

For a simple first deploy:

1. Deploy the Express API from this repo.
2. Add a persistent volume and set `DB_FILE=/data/social.sqlite` and `UPLOAD_DIR=/data/uploads`.
3. Set `NODE_ENV=production`, `PUBLIC_URL`, strong independent `JWT_SECRET` and `DATA_ENCRYPTION_KEY` values, and `ADMIN_EMAILS`.
4. Add SMTP variables from Resend/Mailgun/Postmark.
5. Deploy the Next.js frontend as a second Railway service or deploy it to Vercel with `NEXT_PUBLIC_API_URL` pointing at the Railway API.

## Production database note

The runtime supports SQLite and an initial PostgreSQL query-wrapper path. SQLite is reliable for a small MVP if the database file lives on persistent disk and is backed up. The PostgreSQL path still requires live integration, migration, concurrency, backup, and rollback validation before it should carry production member data.

Recommended next migration:

- Add Railway PostgreSQL and a staging database.
- Introduce versioned migrations (optionally through Prisma or Drizzle).
- Move schema from `src/db.js` into database migrations.
- Validate every route and concurrent write path against PostgreSQL.
- Run import/export migration from `social.sqlite` into PostgreSQL.

## Upload storage note

Uploads go to the private `UPLOAD_DIR` directory and are served only through an authenticated route. Set `UPLOAD_DIR=/data/uploads` when using a persistent Railway volume. Object storage with signed URLs remains the recommended upgrade for multi-instance production deployments.

## Video chat note

Video chat uses WebRTC peer-to-peer media and Socket.IO for signaling. It includes a public STUN server for local/MVP testing. For production reliability, add a TURN service such as Twilio Network Traversal, Xirsys, Metered, or a self-hosted coturn server, then extend the `rtcConfig` in `app/page.jsx`.

## Verification commands

```bash
npm test
npm run frontend:build
curl http://localhost:3000/api/health
```
