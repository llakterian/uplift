# Uplift - Project Specification

**Project Name:** Uplift  
**Tagline:** Your Daily Dose of Good News  
**Version:** 1.0.0  
**Author:** c0bw3b  
**Date:** March 2026

---

## 1. Executive Summary

Uplift is a content aggregation platform that filters and surfaces only positive, inspiring, and uplifting content from across the internet. The app protects users from doom-scrolling and negative news fatigue while keeping them informed about good things happening in the world.

### Core Value Proposition
- **For Users**: A curated, doom-scroll-free news experience that leaves them feeling informed and optimistic
- **Scalable Architecture**: Free-to-build using existing APIs and serverless infrastructure

---

## 2. Goals

### Primary Goals
1. Aggregate content from free, public APIs (Reddit, RSS, Dev.to, Mastodon)
2. Use AI to classify content as Positive/Neutral/Negative
3. Display only positive content with adjustable filter strength
4. Provide a fast, modern PWA experience
5. Keep costs at $0-5/month indefinitely

### Secondary Goals
1. User accounts for personalization
2. Bookmarking and sharing
3. Daily digest notifications
4. Multiple language support
5. Monetization via premium features

---

## 3. Target Audience

| Segment | Demographics | Pain Points |
|---------|-------------|--------------|
| News fatigue victims | 25-45, news consumers | Doom-scrolling, anxiety from negative news |
| Optimists | All ages | Want to stay informed but positive |
| Mental health conscious | 18-35 | Actively avoiding negative content |
| Parents | 30-50 | Want safe, positive content for family |

---

## 4. Content Sources

### Primary Sources (Free APIs)

| Source | Endpoint | Content Type | Positivity Alignment |
|--------|----------|--------------|---------------------|
| Reddit | reddit.com/r/UpliftingNews | Community stories | Very High |
| Reddit | reddit.com/r/GoodNews | Curated good news | Very High |
| Reddit | reddit.com/r/HumansBeingBros | Kindness | Very High |
| Reddit | reddit.com/r/MadeMeSmile | Happy moments | Very High |
| Reddit | reddit.com/r/aww | Cute animals | Very High |
| Reddit | reddit.com/r/science | Scientific discoveries | High |
| RSS | Various good news sites | News articles | High |
| Dev.to | dev.to/api/articles | Tech articles | Medium-High |
| Mastodon | mastodon.social (tags) | Fediverse posts | High |

### Source Requirements
- No API keys required (use public endpoints)
- Rate-limit friendly
- RSS support for websites without APIs

---

## 5. AI Classification System

### Positivity Classification

The AI (Groq) will classify each piece of content into:

```
POSITIVE: Content that is inspiring, uplifting, celebrates wins, good news
NEUTRAL: Informational content without strong emotion
NEGATIVE: Sad, tragic, anxiety-inducing, doom-scrolling content
```

### Classification Prompt

```json
{
  "task": "Classify this news/social post",
  "content": "{post_content}",
  "categories": ["POSITIVE", "NEUTRAL", "NEGATIVE"],
  "score": 1-10 (10 = most positive)
}
```

### Filtering Logic

```
User sets "Positivity Filter" (0-100%)

0-30%: Show all content (for users who want full picture)
31-60%: Show Positive + Neutral
61%: Show mostly-80 Positive with some Neutral
81-100%: Show only highest-rated Positive content
```

---

## 6. Technical Architecture

### Stack

| Component | Technology | Cost |
|-----------|------------|------|
| Frontend | React 18 + Vite + TypeScript | $0 |
| Styling | Tailwind CSS | $0 |
| PWA | Vite PWA Plugin | $0 |
| Backend | Cloudflare Workers (Hono) | $0-5/mo |
| AI | Groq API (Free Tier) | $0 |
| Database | Cloudflare KV (caching) | $0-5/mo |
| Hosting | Cloudflare Pages | $0 |
| Domain | Custom (.news, .app, etc.) | ~$10/year |

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React PWA)                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │  Home    │  │  Feed    │  │Bookmark  │  │  Settings    │  │
│  │  Screen  │  │  View    │  │  List    │  │  Panel       │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND (Cloudflare Workers)                 │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────────────────┐ │
│  │  Rate      │  │   Feed      │  │   AI Classification     │ │
│  │  Limiter   │  │   Fetchers  │  │   (Groq)               │ │
│  └─────────────┘  └─────────────┘  └────────────────────────┘ │
│                         │                                      │
│                         ▼                                      │
│                  ┌─────────────┐                               │
│                  │    KV       │                               │
│                  │   Cache     │                               │
│                  └─────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
                              │
         ┌──────────────────────┼──────────────────────┐
         │                      │                      │
         ▼                      ▼                      ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   Reddit API    │  │   RSS Feeds    │  │   Dev.to API   │
│   (Public)      │  │   (Parsed)     │  │   (Public)     │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/feed` | Get aggregated, classified feed |
| GET | `/api/feed/reddit/:subreddit` | Get Reddit posts |
| GET | `/api/feed/rss` | Get RSS feed items |
| POST | `/api/classify` | Classify single item |
| GET | `/api/categories` | Get available categories |
| POST | `/api/user/bookmarks` | Save bookmark |
| GET | `/api/user/bookmarks` | Get user bookmarks |

---

## 7. Data Models

### FeedItem

```typescript
interface FeedItem {
  id: string;
  title: string;
  content: string;
  source: 'reddit' | 'rss' | 'mastodon' | 'devto';
  sourceName: string;
  sourceUrl: string;
  author: string;
  publishedAt: string;
  
  // AI Classification
  classification: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  positivityScore: number; // 1-10
  
  // UI
  thumbnail?: string;
  tags: string[];
  readTime?: number;
}
```

### UserPreferences

```typescript
interface UserPreferences {
  positivityFilter: number; // 0-100
  categories: string[];
  bookmarkedItems: string[];
  theme: 'light' | 'dark' | 'system';
  language: string;
}
```

---

## 8. Features

### MVP Features (v1.0)

1. **Aggregated Feed**
   - Combine multiple sources
   - AI classification
   - Sorted by positivity score

2. **Positivity Filter**
   - Slider to adjust filter strength
   - Real-time filtering

3. **Category Filters**
   - Science
   - Community
   - Animals
   - Health
   - Inspiration

4. **Bookmarking**
   - Save positive reads
   - Local storage for MVP

5. **Share**
   - Share to social media

6. **Theme Toggle**
   - Light/Dark mode
   - System preference

### Future Features (v1.1+)

1. **Daily Digest**
   - Email notifications
   - Push notifications

2. **User Accounts**
   - Cloud sync
   - Preferences saved

3. **Premium Features**
   - Advanced filters
   - No ads
   - Custom categories

4. **Web3 Integration**
   - NFT badges for top contributors
   - Token-gated features

---

## 9. Frontend Structure

```
uplift/
├── src/
│   ├── components/
│   │   ├── FeedCard.tsx
│   │   ├── PositivitySlider.tsx
│   │   ├── CategoryFilter.tsx
│   │   ├── Header.tsx
│   │   ├── ThemeToggle.tsx
│   │   └── BookmarkButton.tsx
│   ├── hooks/
│   │   ├── useFeed.ts
│   │   └── usePreferences.ts
│   ├── services/
│   │   └── api.ts
│   ├── types/
│   │   └── index.ts
│   ├── App.tsx
│   └── main.tsx
├── public/
│   └── icons/
├── index.html
├── package.json
├── vite.config.ts
└── tailwind.config.js
```

---

## 10. Backend Structure

```
server/
├── src/
│   ├── routes/
│   │   ├── feed.ts          # Feed aggregation
│   │   ├── reddit.ts        # Reddit fetcher
│   │   ├── rss.ts           # RSS parser
│   │   └── classify.ts      # AI classification
│   ├── services/
│   │   ├── groq.ts          # Groq AI service
│   │   └── feed.ts          # Feed merging
│   ├── middleware/
│   │   └── rateLimit.ts
│   └── index.ts             # Main worker
├── wrangler.toml
└── package.json
```

---

## 11. Cost Breakdown

### MVP (0-1000 users)

| Service | Tier | Cost |
|---------|------|------|
| Cloudflare Workers | Free | $0 |
| Cloudflare Pages | Free | $0 |
| Groq API | Free (30/min) | $0 |
| Cloudflare KV | Free (1GB) | $0 |
| Domain | .news | ~$10/year |
| **Total** | | **~$10/year** |

### Growth (1,000-100,000 users)

| Service | Tier | Cost |
|---------|------|------|
| Cloudflare Workers | Paid | $5/month |
| Cloudflare Pages | Free | $0 |
| Groq API | Free + Paid | $0-20/month |
| Cloudflare KV | Paid | $5/month |
| Domain | .news | ~$10/year |
| **Total** | | **~$20-40/month** |

### Scale (100,000+ users)

| Service | Tier | Cost |
|---------|------|------|
| Cloudflare Workers | Pro | $20/month |
| Cloudflare Pages | Pro | $0 |
| Groq API | Paid | $50/month |
| Cloudflare KV | Pro | $10/month |
| Domain | .news | ~$10/year |
| **Total** | | **~$90/month** |

---

## 12. Development Roadmap

### Phase 1: MVP (Week 1-2)
- [ ] Set up project structure
- [ ] Build Reddit fetcher
- [ ] Build RSS parser
- [ ] Integrate Groq classification
- [ ] Build basic React frontend
- [ ] Deploy to Cloudflare

### Phase 2: Features (Week 3-4)
- [ ] Add more sources (Mastodon, Dev.to)
- [ ] Category filtering
- [ ] Bookmarking
- [ ] Share functionality
- [ ] Theme toggle

### Phase 3: Polish (Week 5-6)
- [ ] PWA features
- [ ] Performance optimization
- [ ] UI/UX improvements
- [ ] Testing

### Phase 4: Launch (Week 7-8)
- [ ] User testing
- [ ] Bug fixes
- [ ] Marketing setup
- [ ] Launch

---

## 13. Competitive Analysis

### Alternatives

| App | Strengths | Weaknesses |
|-----|-----------|-------------|
| Reddit (r/UpliftingNews) | Authentic | Mixed with negative |
| GoodNews | Simple | Limited sources |
| PositiveNews | Focused | Not scalable |
| Ground News | Balance view | Still has negative |

### Uplift Differentiation
- **AI-powered classification** - True positivity filtering
- **Multi-source aggregation** - Comprehensive coverage
- **Adjustable filters** - User control
- **Modern PWA** - Great UX

---

## 14. Success Metrics

### KPIs

| Metric | Target (Month 1) | Target (Month 6) |
|--------|-----------------|-------------------|
| Users | 100 | 10,000 |
| Daily Active | 50 | 2,000 |
| Avg Session | 5 min | 10 min |
| Positivity Score | 8/10 | 9/10 |

---

## 15. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-------------|
| Reddit API changes | Medium | High | Add more sources |
| Groq limits | Medium | Medium | Cache aggressively |
| Negative content leaks | Low | High | Human review queue |
| Scaling costs | Low | Medium | Freemium model |

---

## 16. Next Steps

1. Initialize project repository
2. Set up Cloudflare Workers
3. Build feed fetchers
4. Integrate Groq classification
5. Build frontend
6. Deploy MVP

---

**Document Version:** 1.0  
**Last Updated:** March 2026
