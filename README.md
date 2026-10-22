# Uplift — Good News Aggregation Platform

A production-ready good news aggregation platform built with React, TypeScript,
and Cloudflare Workers. Uplift curates positive stories from multiple sources
worldwide, filters them with AI, and delivers them as an installable PWA.

## Overview

Uplift curates positive stories from multiple sources worldwide, featuring:

- Multi-language support (English / Swahili)
- AI-powered positivity classification
- Real-time feed updates with KV caching
- Social sharing with preview cards
- Responsive, X.com-style interface
- PWA with offline caching and push notifications
- Creators Circle for mutual amplification between verified creators

## Tech Stack

**Frontend**

- React 18 + TypeScript
- Vite 6 (build tool)
- Tailwind CSS 3
- Framer Motion (animations)
- `vite-plugin-pwa` (service worker + manifest)

**Backend**

- Cloudflare Workers (edge runtime)
- Hono.js framework
- D1 Database (SQLite)
- KV Storage (caching + sessions)
- Groq API (AI classification and copy)

## Quick Start

```bash
# 1. Frontend dependencies
npm install

# 2. Backend dependencies
cd server && npm install

# 3. Create local secrets (git-ignored)
cp .dev.vars.example .dev.vars
#    then fill in GROQ_API_KEY, SESSION_SECRET, TG_WEBHOOK_SECRET

# 4. Apply the database schema to local D1
npx wrangler d1 execute uplift-db --local --file=schema.sql

# 5. Start the backend (in one terminal)
cd server && npm run dev      # http://localhost:8787

# 6. Start the frontend (in another terminal)
npm run dev                    # http://localhost:5173
```

The Vite dev server proxies `/api` to `http://localhost:8787`.

> The app is fully usable without any API keys — the Worker falls back to a
> heuristic positivity classifier. Keys unlock AI features, the Creators
> Circle sync, Telegram notifications and push.

## Environment Variables

Secrets are **never** committed. Local development uses `server/.dev.vars`
(template: `server/.dev.vars.example`); production uses
`npx wrangler secret put <NAME>`.

| Variable | Description | Required |
|---|---|---|
| `GROQ_API_KEY` | Groq API key for AI classification and copy | For AI features |
| `SESSION_SECRET` | Secret for session management | Yes |
| `TG_WEBHOOK_SECRET` | Shared secret Telegram sends as `X-Telegram-Bot-Api-Secret-Token` | Yes (Telegram) |
| `TG_BOT_TOKEN` | Telegram bot token from @BotFather | No |
| `X_BEARER_TOKEN` | X (Twitter) API bearer token | No |
| `X_CLIENT_ID` / `X_CLIENT_SECRET` | X OAuth app credentials | No |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web Push keys | No |
| `ALLOWED_ORIGINS` | Comma-separated CORS allowlist | No (has defaults) |
| `IMAGE_PROXY_ALLOWED_DOMAINS` | Optional image-proxy domain allowlist | No |

See [`SECURITY.md`](./SECURITY.md) for the full security model, known
limitations, and the credential-rotation checklist.

## Deployment

### Prerequisites

- Node.js 18+ (20+ recommended)
- A Cloudflare account
- A Groq API key (free tier available)

### Steps

1. **Build the frontend:**
   ```bash
   npm run build
   ```

2. **Apply the database schema:**
   ```bash
   cd server
   npx wrangler d1 execute uplift-db --remote --file=schema.sql
   ```

3. **Set the secrets:**
   ```bash
   npx wrangler secret put GROQ_API_KEY
   npx wrangler secret put SESSION_SECRET
   npx wrangler secret put TG_WEBHOOK_SECRET
   # ...and any others you need
   ```

4. **Deploy:**
   ```bash
   npx wrangler deploy
   ```

The Worker serves the built frontend from `../dist` and proxies API requests.
`run_worker_first = true` in `wrangler.toml` ensures the security headers
(CSP, HSTS, …) are applied to the HTML shell as well as to API responses.

## Features

### Content sources

Defined in `server/src/services/feed.ts`:

- **Reddit** — positive communities (`r/UpliftingNews`, `r/GoodNews`, …)
- **RSS** — good-news networks (Good News Network, Positive News, Upworthy, …)
- **Dev.to** — technology and career articles
- **Mastodon** — `#goodnews`, `#uplift`, `#nature` hashtags
- **Hacker News** — Show HN
- **X / Twitter** — positive accounts (requires `X_BEARER_TOKEN`)

`GET /api/feed/sources` returns the live list.

### UI

- X.com-style compact feed with category filtering
- Positivity filter slider (0–100%)
- Clickable image lightbox with zoom
- Language switcher (EN / SW)
- Auto-refresh with background updates
- Account sign-in with server-synced bookmarks and streak tracking
- Share with Open Graph preview cards

### Security

- PBKDF2-SHA256 password hashing with per-user salts and transparent
  legacy-hash upgrade
- Opaque KV-backed sessions; the user id is derived from the session token,
  never from a client header
- SSRF-safe image proxy (private/link-local/metadata IP blocking, manual
  redirect re-validation, size caps)
- Strict CSP (`script-src 'self'`, no `unsafe-inline` / `unsafe-eval`)
- HSTS, `frame-ancestors 'none'`, `nosniff`, restrictive `Permissions-Policy`
- Per-route rate limiting (stricter on auth and the image proxy)
- Telegram webhook secret-token authentication
- HTML sanitisation of all upstream content

## API Endpoints

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/feed` | GET | – | Curated feed (paginated, filtered by category/score) |
| `/api/feed/daily-digest` | GET | optional | Daily digest with AI intro; `?stream=true` for SSE |
| `/api/feed/why-this` | POST | – | AI explanation for a story |
| `/api/feed/sources` | GET | – | List the curated content sources |
| `/api/feed/rss` | GET | – | Fetch a curated RSS feed by name |
| `/api/feed/reddit/:subreddit` | GET | – | Posts from a single subreddit |
| `/api/categories` | GET | – | Static category list |
| `/api/bookmarks` | GET / POST / DELETE | session | User bookmarks |
| `/api/auth/register` | POST | – | Create an account (returns a session token) |
| `/api/auth/login` | POST | – | Sign in (returns a session token) |
| `/api/auth/me` | GET | session | Current user profile |
| `/api/auth/logout` | POST | session | Revoke the current session |
| `/api/auth/x` | GET | – | X OAuth entry point (stub) |
| `/api/circle/directory` | GET | – | Verified creators directory |
| `/api/circle/feed` | GET | – | Circle posts feed |
| `/api/circle/leaderboard` | GET | – | Creator leaderboard |
| `/api/circle/join` | POST | – | Apply to join the Circle |
| `/api/circle/amplify` | POST | – | Record an amplification |
| `/api/image-proxy` | GET | – | SSRF-safe image proxy |
| `/api/push/subscribe` | POST | session | Register a push subscription |
| `/api/push/vapid-public-key` | GET | – | VAPID public key |
| `/telegram-webhook/webhook` | POST | secret token | Telegram updates |

Protected endpoints expect `Authorization: Bearer <session-token>`.

## Project Structure

```
uplift/
├── src/                        # Frontend
│   ├── components/             # React components
│   ├── pages/                  # Page components
│   ├── services/               # API clients (api.ts, auth.ts, circleApi.ts)
│   ├── types/                  # TypeScript types
│   └── utils/                  # Utilities
├── server/                     # Cloudflare Worker
│   ├── src/
│   │   ├── index.ts            # Worker entry point
│   │   ├── config.ts           # CORS origins, query parsing
│   │   ├── cron.ts             # Scheduled handler
│   │   ├── middleware/         # auth.ts, rateLimit.ts
│   │   ├── routes/             # HTTP route modules
│   │   ├── services/           # feed, groq, cache, security, telegram
│   │   └── types.ts
│   ├── schema.sql              # D1 schema
│   └── wrangler.toml
├── .github/workflows/ci.yml    # CI: typecheck, build, secret scan
├── public/                     # Static assets
└── dist/                       # Built frontend
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the frontend dev server |
| `npm run build` | Build the frontend |
| `npm run preview` | Preview the production build |
| `cd server && npm run dev` | Start the Worker locally (wrangler) |
| `cd server && npm run build` | Typecheck the Worker |
| `cd server && npx wrangler deploy` | Deploy the Worker |
| `cd server && npx wrangler d1 execute uplift-db --local --file=schema.sql` | Apply the schema locally |

## Performance

- Edge deployment (300+ locations)
- KV caching with background refresh; pagination is applied after the cache
  read so paging does not trigger a re-fetch
- Parallel upstream fetching via `Promise.allSettled`
- Service-worker runtime caching for API, Reddit and fonts
- Image proxy with KV caching and size caps

## Repository Security

`main` should be protected from force pushes and deletions. Note that
**classic branch protection and repository rulesets are only available on
public repositories or on a paid GitHub plan** — on a private repository under
a free plan GitHub returns:

> Upgrade to GitHub Pro or make this repository public to enable this feature.

To enable protection, either upgrade the plan or make the repository public.
Until then, CI runs on every push to `main` and on every pull request, and the
secret scan covers the full git history.

## License

MIT License

## Contact

Prepared by llakterian @ c0bw3b Inc.
Email: llakterian@gmail.com
