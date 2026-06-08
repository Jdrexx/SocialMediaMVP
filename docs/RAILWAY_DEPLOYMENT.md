# Railway Deployment Guide

This app is Railway-ready as a single Node service that serves both:

- the Express API and Socket.IO realtime server
- the built Next.js frontend

## 1. Create the Railway service

1. Go to Railway.
2. Create a new project.
3. Choose **Deploy from GitHub repo**.
4. Select `Jdrexx/SocialMediaMVP`.
5. Railway will use `railway.json`:
   - build: `npm ci && npm run build`
   - start: `npm start`
   - health check: `/api/health`

## 2. Add required environment variables

Set these in Railway service variables:

```env
NODE_ENV=production
JWT_SECRET=<generate-a-long-random-secret-at-least-32-chars>
PUBLIC_URL=https://<your-railway-domain>
DB_FILE=/data/social.sqlite
```

Generate a secret locally:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 3. Add a Railway volume for SQLite

The app still uses SQLite, so production needs persistent disk.

1. In Railway, add a **Volume** to the service.
2. Mount it at:

```text
/data
```

3. Keep:

```env
DB_FILE=/data/social.sqlite
```

Without this, Railway's ephemeral filesystem can lose the database on redeploys.

## 4. Optional SMTP variables

For real password reset and email verification emails, add SMTP settings:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
SMTP_FROM="Social Media MVP <no-reply@yourdomain.com>"
```

If SMTP is not configured, local/dev endpoints return `dev_token`. Do not rely on `dev_token` for public production use.

## 5. Custom domain

After deployment:

1. Open the Railway service.
2. Go to Settings / Networking.
3. Generate a Railway domain or add your custom domain.
4. Set `PUBLIC_URL` to the final HTTPS URL.

## 6. Video chat production note

Video chat uses WebRTC peer-to-peer media with Socket.IO signaling. The app has a STUN server for MVP testing. For reliable production calls, add a TURN provider later, such as:

- Twilio Network Traversal
- Xirsys
- Metered
- self-hosted `coturn`

Then update `rtcConfig` in `app/page.jsx`.

## 7. Verify after deploy

Open:

```text
https://<your-railway-domain>/api/health
```

Expected shape:

```json
{
  "ok": true,
  "features": ["auth", "uploads", "users", "posts", "notifications", "search", "moderation", "messages"],
  "realtime": { "transport": "socket.io" },
  "production": true
}
```

Then open the Railway domain root `/` and verify the Next.js frontend loads.

## 8. Known MVP production limitations

- SQLite with a Railway volume is fine for a single-instance MVP; PostgreSQL is recommended for higher traffic or multi-instance scaling.
- Uploaded files currently save to `public/uploads`; for long-term production, move uploads to Cloudflare R2, S3, UploadThing, or another object store.
- Socket.IO is single-instance by default; if scaling horizontally, add the Redis adapter.
