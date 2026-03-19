# Uplift - Good News Aggregation Platform

A production-ready good news aggregation platform built with React, TypeScript, and Cloudflare Workers.

## Overview

Uplift curates positive stories from multiple sources worldwide, featuring:
- Multi-language support (English/Swahili)
- AI-powered content analysis
- Real-time feed updates
- Social sharing with preview cards
- Responsive X.com-style interface

## Tech Stack

**Frontend:**
- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS
- Framer Motion (animations)
- PWA with service worker

**Backend:**
- Cloudflare Workers
- Hono.js framework
- D1 Database (SQLite)
- KV Storage (caching)
- Groq API (AI features)

## Quick Start

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd server && npm install

# Start frontend dev server
npm run dev

# Start backend (in separate terminal)
cd server && npm run dev
```

## Deployment

### Prerequisites
- Node.js 18+
- Cloudflare account
- Groq API key (free tier available)

### Steps

1. **Configure environment:**
   ```bash
   cd server
   cp .env.example .env
   # Add your GROQ_API_KEY
   ```

2. **Create Cloudflare resources:**
   ```bash
   npx wrangler d1 create uplift-db
   npx wrangler kv:namespace create "UPLIFT_CACHE"
   ```

3. **Update wrangler.toml** with your database and KV IDs.

4. **Deploy:**
   ```bash
   npm run build
   cd server && npx wrangler deploy
   ```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| GROQ_API_KEY | Groq API key for AI features | Yes |
| SESSION_SECRET | Secret for session management | Yes |
| VAPID_PUBLIC_KEY | Push notification public key | No |
| VAPID_PRIVATE_KEY | Push notification private key | No |

## Features

### Content Sources
- Reddit (positive communities)
- RSS feeds (good news networks)
- Dev.to (tech articles)
- Art/photography subreddits

### UI Features
- X.com-style compact feed
- Clickable image lightbox with zoom
- Language switcher (EN/SW)
- Positivity filter slider
- Auto-refresh with background updates
- Share with preview cards

### Security
- XSS protection with HTML sanitization
- SSRF prevention with URL validation
- Rate limiting (distributed)
- Security headers (CSP, HSTS, etc.)
- Input validation

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/feed` | GET | Get curated feed |
| `/api/daily-digest` | GET | Daily digest with AI intro |
| `/api/why-this` | POST | AI explanation for story |
| `/api/bookmarks` | GET/POST/DELETE | User bookmarks |
| `/api/auth/register` | POST | User registration |
| `/api/auth/login` | POST | User login |
| `/api/share/:id` | GET | Share page with OG tags |
| `/api/image-proxy` | GET | Image resizing proxy |

## Project Structure

```
uplift/
├── src/
│   ├── components/      # React components
│   ├── pages/           # Page components
│   ├── services/       # API client
│   ├── types/           # TypeScript types
│   └── utils/           # Utilities
├── server/
│   └── src/
│       └── index.ts     # Cloudflare Worker
├── public/              # Static assets
└── dist/                # Built frontend
```

## Configuration

### Allowed Origins
Update `ALLOWED_ORIGINS` in wrangler.toml:
```toml
[vars]
ALLOWED_ORIGINS = "https://yoursite.com,http://localhost:5173"
```

### Content Sources
Modify source arrays in `server/src/index.ts`:
- `POSITIVE_REDDIT_SUBS` - Reddit communities
- `POSITIVE_RSS_FEEDS` - RSS feed URLs
- `POSITIVE_DEVTO_TAGS` - Dev.to tags

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start frontend dev server |
| `npm run build` | Build frontend |
| `npm run preview` | Preview production build |
| `cd server && npm run dev` | Start backend |
| `cd server && npx wrangler deploy` | Deploy backend |

## Performance

- Edge deployment (300+ locations)
- KV caching for fast responses
- Parallel API fetching
- Service worker caching
- Image proxy with caching

## License

MIT License

## Contact

Prepared by llakterian @ c0bw3b Inc.
Email: llakterian@gmail.com
