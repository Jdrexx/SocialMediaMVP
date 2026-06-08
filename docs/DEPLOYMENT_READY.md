# Deployment Readiness

This project is now closer to a production deploy, but still keeps the MVP-friendly SQLite/local-upload defaults for fast iteration.

## What changed before deployment

- Next.js frontend added under `app/`.
- SMTP-backed email sending added with Nodemailer.
- Password reset and email verification send real email when SMTP env vars are present.
- Profile photos and cover images can be set from authenticated image uploads.
- Socket.IO realtime server added for chat message delivery and typing indicators.
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
DB_FILE=/data/social.sqlite
```

Email variables for real verification/reset messages:

```env
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=resend
SMTP_PASS=<your-password-or-api-key>
SMTP_FROM="Social Media MVP <no-reply@your-domain.com>"
```

Next.js frontend variable:

```env
NEXT_PUBLIC_API_URL=https://your-api-domain.com
```

## Railway deployment recommendation

For a simple first deploy:

1. Deploy the Express API from this repo.
2. Add a persistent volume and set `DB_FILE=/data/social.sqlite`.
3. Set `NODE_ENV=production`, `PUBLIC_URL`, and a strong `JWT_SECRET`.
4. Add SMTP variables from Resend/Mailgun/Postmark.
5. Deploy the Next.js frontend as a second Railway service or deploy it to Vercel with `NEXT_PUBLIC_API_URL` pointing at the Railway API.

## Production database note

The runtime currently uses `better-sqlite3`, which is reliable for a small MVP if the database file lives on persistent disk and is backed up. For multi-instance/high-traffic production, migrate to PostgreSQL before horizontal scaling.

Recommended next migration:

- Add Railway PostgreSQL.
- Introduce Prisma or Drizzle.
- Move schema from `src/db.js` into database migrations.
- Convert route DB calls from synchronous `better-sqlite3` calls to async ORM/query calls.
- Run import/export migration from `social.sqlite` into PostgreSQL.

## Upload storage note

Uploads currently go to `public/uploads`. This is acceptable for a single-instance MVP with persistent disk. For production, move media to object storage such as Cloudflare R2, S3, or UploadThing.

## Verification commands

```bash
npm test
npm run frontend:build
curl http://localhost:3000/api/health
```
