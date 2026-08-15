# MySazz Community

[![CI](https://github.com/Jdrexx/SocialMediaMVP/actions/workflows/ci.yml/badge.svg)](https://github.com/Jdrexx/SocialMediaMVP/actions/workflows/ci.yml)

MySazz is becoming a private, safety-first community for adults moving forward with lived experience. The product combines member stories, intentional connections, private conversation, peer support, and trustworthy local resource navigation.

This repository began as a general-purpose social-media MVP. Its new direction is a purpose-built MySazz platform with stronger eligibility, consent, privacy, connection, moderation, and safety boundaries.

> MySazz is not therapy, diagnosis, treatment, crisis response, or medical advice. If someone may be in immediate danger in the United States, call emergency services or call/text 988. See the in-app Resources page for more information.

## Product direction

MySazz is designed around four principles:

1. **Intentional membership.** Members self-attest that they are at least 18, meet the recovery/lived-experience eligibility described by MySazz, agree to member confidentiality, and understand the platform is not medical care.
2. **Privacy by choice.** Relationship status and lived-experience tags are private unless the member explicitly shares them. Postal codes remain private and are reserved for resource discovery.
3. **Mutual connection first.** Messaging and video calls require an accepted connection. Blocking applies throughout discovery, feeds, connections, messaging, and calls.
4. **Source-backed help.** The planned Resource Navigator will retrieve verified directory records and use AI only to interpret needs and rank those records—never to invent providers or make clinical decisions.

## Current implementation

### Membership and identity

- Email/password registration with HTTP-only JWT sessions
- Versioned 18+, recovery, confidentiality, Terms, Privacy, and non-medical-care attestations
- Onboarding flow for accounts created before the MySazz transition
- Production email verification before member interactions
- Authenticator-app TOTP two-factor authentication
- Explicit production administrator bootstrap through `ADMIN_EMAILS`

### Community

- Authenticated member stories, posts, comments, likes, bookmarks, and notifications
- Privacy-controlled profiles with connection intentions, optional lived-experience tags, approximate location, and presence
- Discoverability controls and private postal-code storage
- Mutual connection request, acceptance, decline, and removal flows
- Connection-gated messaging and WebRTC video signaling
- AES-256-GCM encrypted message storage and privacy-safe message notifications
- Authenticated image/video storage outside the public web root

### Trust, safety, and member control

- Global blocking across profiles, search, feeds, follows, connections, messages, and calls
- Post, member, and message reporting
- Admin moderation dashboard and activity log
- Member data export
- Password-confirmed permanent account deletion
- Rate limits, input validation, CSP/Helmet headers, CSRF checks, and hashed reset/verification tokens

## Resource Navigator roadmap

The local-resource feature is intentionally API-first. Unrestricted scraping is too brittle and difficult to verify for mental-health information. Page scraping will be limited to approved sources whose terms and robots rules allow it.

The planned flow is:

```text
Official API / dataset / approved local source
                    ↓
        validate, normalize, deduplicate
                    ↓
       versioned catalog with provenance
                    ↓
    deterministic location and filter search
                    ↓
      AI intent classification and reranking
                    ↓
 source-backed results with last-checked dates
```

Recommended initial sources:

- [SAMHSA FindTreatment.gov](https://findtreatment.gov/about), using its registered API access path
- [211 National Data Platform](https://apiportal.211.org/), subject to access and reuse terms
- [HRSA Health Center data](https://data.hrsa.gov/topics/health-centers), using official downloadable records
- [988 Lifeline](https://988lifeline.org/get-help/what-to-expect/) and other small, human-reviewed crisis-resource records
- Approved state, county, and nonprofit directories with documented correction contacts

Delivery phases:

1. Resource catalog schema, HRSA importer, deterministic radius search, provenance cards, corrections, and a human-reviewed crisis table
2. SAMHSA and 211 connectors after access and reuse approval
3. Strict-schema AI intent classification over a closed service taxonomy
4. Source-grounded reranking and explanations with zero unsupported provider claims
5. Approved local connectors, reviewer queues, freshness monitoring, and launch evaluation

The full design, privacy model, crawler safeguards, API proposal, and launch gates are in [docs/AI_RESOURCE_NAVIGATOR.md](docs/AI_RESOURCE_NAVIGATOR.md).

## Status and boundaries

The MySazz community foundation is implemented. The automated Resource Navigator and external data connectors are planned but are **not live yet**.

This code should still be treated as pre-production for sensitive user data. Before launch, complete the independent security/privacy review, media-storage hardening, backup and restore validation, incident-response preparation, moderator operations, accessibility review, and legal review listed in [docs/SECURITY.md](docs/SECURITY.md).

The Terms, Privacy Policy, and eligibility language in the app are product drafts and are not a substitute for legal review.

## Technology

- Next.js 16 and React 19
- Express 4 API
- TypeScript
- SQLite for local/single-instance use
- Preliminary PostgreSQL query-wrapper support
- Socket.IO for realtime messages and WebRTC signaling
- Zod validation
- bcrypt password hashing
- AES-256-GCM application-layer encryption

## Visual identity

The interface follows the business report’s original MySazz direction while updating it for a modern, accessible product:

- Deep navy `#172554` for navigation, structure, and trust
- Sky blue `#69C5E8` for hopeful storytelling areas and highlights
- Paper white `#F5F9FB` and white cards for openness and readability
- Charcoal `#172033` for body copy
- Georgia-inspired display typography paired with a clear system sans-serif

The square mark is stored at `public/brand/mysazz-mark.svg`. The landing-page image at `public/brand/mysazz-community-hero.webp` is an original MySazz asset rather than an enlarged copy of the low-resolution report screenshots.

## Local development

Requirements:

- Node.js 20 or newer
- npm

Install and run the integrated API and Next.js application:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To run the frontend separately with its API/upload proxy:

```bash
# Terminal 1
SERVE_NEXT=false npm run dev

# Terminal 2
npm run frontend:dev
```

Open [http://localhost:3001](http://localhost:3001).

The first registered account becomes an administrator only in development/test unless `BOOTSTRAP_FIRST_USER_ADMIN=false`. Production never uses the first-user shortcut.

## Validation

```bash
npm test
npm run typecheck
npm run build
```

The current suite covers membership attestations, profile privacy, protected media, connections, blocks, encrypted messages, two-factor authentication, production email gating, account export/deletion, persistent SQLite paths, moderation, and realtime video signaling.

## Configuration

Copy `.env.example` into your preferred local environment configuration and adjust it as needed.

Local defaults:

```env
NODE_ENV=development
PORT=3000
PUBLIC_URL=http://localhost:3000
JWT_SECRET=dev-secret-change-me
DB_FILE=social.sqlite
UPLOAD_DIR=storage/uploads
```

Minimum single-instance production configuration:

```env
NODE_ENV=production
PUBLIC_URL=https://your-domain.com
JWT_SECRET=<strong-random-secret-at-least-32-characters>
DATA_ENCRYPTION_KEY=<independent-64-character-hex-key>
DB_FILE=/data/social.sqlite
UPLOAD_DIR=/data/uploads
ADMIN_EMAILS=owner@your-domain.com

SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<smtp-user>
SMTP_PASS=<smtp-password>
SMTP_FROM="MySazz <noreply@your-domain.com>"
```

Attach persistent storage at `/data` when using SQLite. Back up both the database and `DATA_ENCRYPTION_KEY` securely; losing the encryption key makes encrypted messages unreadable.

PostgreSQL support needs staging integration, migration, concurrency, backup, and rollback validation before carrying production member data.

## Project layout

```text
app/                         Next.js pages and policy/resource content
components/                  Community, onboarding, profile, chat, and discovery UI
src/app.ts                   Express middleware and feature registration
src/db.ts                    Membership/community schema initialization
src/features/auth/           Registration, verification, password, and TOTP flows
src/features/connections/    Mutual connection lifecycle
src/features/messages/       Encrypted connection-gated messaging
src/features/moderation/     Reporting and administrative moderation
src/features/posts/          Member stories and feed interactions
src/features/search/         Privacy- and block-aware discovery
src/features/uploads/        Authenticated private media storage
src/features/users/          Profiles, onboarding, export, and deletion
src/lib/membership.ts        Consent, privacy, and connection helpers
src/lib/crypto.ts            Sensitive-field encryption
src/lib/realtime.ts          Socket.IO and WebRTC signaling controls
storage/uploads/             Local private member media
tests/                       API, privacy, safety, persistence, and realtime tests
```

## Core API surface

- Auth: `/api/auth/register`, `/api/auth/login`, verification, reset, and `/api/auth/2fa/*`
- Member: `/api/me`, `/api/me/onboarding`, `/api/me/export`, and account deletion
- Profiles and feed: `/api/users/*`, `/api/posts`, and `/api/feed`
- Connections: `/api/connections/*`
- Messaging: `/api/messages/*`
- Media: `/api/uploads` and authenticated `/uploads/*`
- Trust and safety: `/api/blocks/*`, `/api/reports/*`, and `/api/admin/*`

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [AI Resource Navigator](docs/AI_RESOURCE_NAVIGATOR.md)
- [Security and privacy status](docs/SECURITY.md)
- [Deployment readiness](docs/DEPLOYMENT_READY.md)
- [Railway deployment](docs/RAILWAY_DEPLOYMENT.md)
- [Adding features](docs/ADDING_FEATURES.md)

## Contributing

Keep changes aligned with the privacy and safety boundaries above. New member-facing behavior should include authorization and block-propagation tests. New resource connectors must document source authorization, provenance, refresh behavior, failure handling, and a correction path before they can be enabled.
