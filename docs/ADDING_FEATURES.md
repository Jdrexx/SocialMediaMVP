# Adding Features Guide

This app is organized so new features can be added without turning `src/app.js` into a giant file.

## Current backend layout

```text
src/
  app.js                  # Express setup, middleware, health, feature registration
  db.js                   # SQLite schema/migrations
  server.js               # Production/local server entrypoint
  features/
    index.js              # Feature registry: mount path + route factory
    auth/routes.js        # Register, login, logout, session
    users/routes.js       # Profiles and follows
    posts/routes.js       # Posts, feed, likes, comments
  lib/
    auth.js               # JWT/session helpers
    http.js               # Shared middleware and API helpers
    posts.js              # Shared post serialization/query helpers
    schemas.js            # Shared Zod request validation schemas
```

## Feature pattern

Each feature should live in its own folder:

```text
src/features/<feature-name>/
  routes.js               # Express router for this feature
  service.js              # Optional business logic
  repository.js           # Optional database reads/writes
```

Then register it in `src/features/index.js`:

```js
import { createMessagesRouter } from './messages/routes.js';

export const featureRegistry = [
  // existing features...
  {
    name: 'messages',
    mountPath: '/api',
    createRouter: createMessagesRouter
  }
];
```

A route file should export one factory that receives app dependencies:

```js
import express from 'express';
import { authRequired } from '../../lib/http.js';

export function createMessagesRouter({ db }) {
  const router = express.Router();

  router.get('/messages', authRequired, (req, res) => {
    const messages = db.prepare('SELECT * FROM messages WHERE recipient_id = ?').all(req.user.id);
    res.json({ messages });
  });

  return router;
}
```

## Database changes

Add new tables/indexes in `src/db.js` inside `migrate(db)`.

Rules:

1. Use `CREATE TABLE IF NOT EXISTS` for new tables.
2. Use `CREATE INDEX IF NOT EXISTS` for indexes.
3. Keep foreign keys explicit with `REFERENCES ... ON DELETE CASCADE` when records belong to users/posts.
4. For complex future migrations, add a `schema_migrations` table before changing existing columns.

## Test-first upgrade workflow

Every new backend feature should follow this order:

1. Add/extend a test in `tests/*.test.js`.
2. Run the exact test and confirm it fails for the expected reason.
3. Add the smallest implementation.
4. Run the exact test again.
5. Run the full suite:

```bash
npm test
```

6. Start the app and do a browser smoke test for UI-facing features:

```bash
npm start
```

Open http://localhost:3000 and verify the feature from the UI.

## Frontend upgrade pattern

The frontend is intentionally simple right now:

```text
public/index.html   # Structure
public/style.css    # Styling
public/app.js       # Browser API calls and rendering
```

For small features, add a section/form to `index.html`, styles to `style.css`, and API handlers/rendering to `app.js`.

If the frontend grows past MVP size, upgrade to Vite + React or Next.js while keeping the same API routes.

## Recommended feature roadmap

### Easy next features

- Post delete button in UI
- Edit profile page polish
- User search
- Hashtags
- Bookmarks/saved posts
- Better empty/loading states

### Medium features

- Direct messages
- Notifications
- Image upload storage
- Password reset
- Email verification
- Report/block users
- Infinite scrolling/pagination

### Production features

- PostgreSQL instead of SQLite
- HTTPS-only secure cookies
- Strong `JWT_SECRET` via `.env`
- Rate limits per route/user
- Admin moderation dashboard
- Background jobs for email/media processing
- Observability/logging
- Backups and deploy pipeline

## Scaffolding helper

Use the included helper to create a feature folder and route stub:

```bash
npm run scaffold:feature messages
```

Then wire it into `src/features/index.js`, add tests, and implement the routes.
