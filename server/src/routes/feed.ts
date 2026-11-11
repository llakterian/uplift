import { Hono } from 'hono'
import type { Env, FeedItem } from '../types'
import { fetchAllSources, fetchRedditPosts, fetchRSSFeed, POSITIVE_RSS_FEEDS, POSITIVE_REDDIT_SUBS, POSITIVE_DEVTO_TAGS } from '../services/feed'
import { getCachedFeed, setCachedFeed } from '../services/cache'
import { generateAIDeepDive, generateDailyIntro } from '../services/groq'
import { sanitizeHtml, isValidSubreddit } from '../services/security'
import { getSessionUser } from '../middleware/auth'
import { parseBoundedInt, corsOriginFor } from '../config'

const app = new Hono<{ Bindings: Env }>()

/**
 * Cache key for a feed variant. Pagination is applied after the cached list is
 * read, so the key deliberately excludes page/limit — otherwise every page
 * would trigger its own full re-fetch of all upstream sources.
 */
function feedCacheKey(category: string | undefined, minScore: number): string {
  return `feed:v2:${category || 'all'}:${minScore}`
}

async function refreshFeedCache(env: Env, category?: string, minScore?: number): Promise<void> {
  try {
    const posts = await fetchAllSources(env)

    let allPosts = posts
    if (category) {
      allPosts = allPosts.filter(p => p.category === category)
    }
    if (minScore && minScore > 0) {
      allPosts = allPosts.filter(p => p.positivityScore >= minScore)
    }

    allPosts.sort((a, b) => {
      if (b.positivityScore !== a.positivityScore) {
        return b.positivityScore - a.positivityScore
      }
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    })

    allPosts = allPosts.map(p => ({ ...p, _cachedAt: new Date().toISOString() }))

    // Deduplicate by id
    const seen = new Set<string>()
    allPosts = allPosts.filter(p => {
      if (seen.has(p.id)) return false
      seen.add(p.id)
      return true
    })

    // Truncate content server-side to reduce payload
    allPosts = allPosts.map(p => ({
      ...p,
      content: p.content && p.content.length > 500 ? p.content.substring(0, 500) + '\u2026' : p.content
    }))

    await setCachedFeed(env.UPLIFT_CACHE, feedCacheKey(category, minScore || 0), allPosts)
  } catch (error) {
    console.error('Background cache refresh failed:', error)
  }
}

app.get('/', async (c) => {
  const category = c.req.query('category')
  const minScore = parseBoundedInt(c.req.query('minScore'), 0, 0, 10)
  const page = parseBoundedInt(c.req.query('page'), 1, 1, 10000)
  const limit = parseBoundedInt(c.req.query('limit'), 50, 1, 100)

  const cacheKey = feedCacheKey(category, minScore)
  const cached = await getCachedFeed(c.env.UPLIFT_CACHE, cacheKey)

  if (cached) {
    const cacheAge = Date.now() - (cached[0]?._cachedAt ? new Date(cached[0]._cachedAt).getTime() : 0)
    if (cacheAge > 5 * 60 * 1000) {
      c.executionCtx?.waitUntil?.(refreshFeedCache(c.env, category, minScore))
    }
    const start = (page - 1) * limit
    const paginatedPosts = cached.slice(start, start + limit)
    return c.json({ success: true, posts: paginatedPosts, cached: true, pagination: { page, limit, total: cached.length } })
  }

  const posts = await fetchAllSources(c.env)
  let allPosts = posts

  if (category) allPosts = allPosts.filter(p => p.category === category)
  if (minScore > 0) allPosts = allPosts.filter(p => p.positivityScore >= minScore)

  allPosts.sort((a, b) => {
    if (b.positivityScore !== a.positivityScore) return b.positivityScore - a.positivityScore
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  })

  allPosts = allPosts.map(p => ({ ...p, _cachedAt: new Date().toISOString() }))

  // Deduplicate by id
  const seen = new Set<string>()
  allPosts = allPosts.filter(p => {
    if (seen.has(p.id)) return false
    seen.add(p.id)
    return true
  })

  // Truncate content server-side to reduce payload
  allPosts = allPosts.map(p => ({
    ...p,
    content: p.content && p.content.length > 500 ? p.content.substring(0, 500) + '\u2026' : p.content
  }))

  await setCachedFeed(c.env.UPLIFT_CACHE, cacheKey, allPosts)

  const start = (page - 1) * limit
  const paginatedPosts = allPosts.slice(start, start + limit)

  return c.json({ success: true, posts: paginatedPosts, cached: false, pagination: { page, limit, total: allPosts.length } })
})

app.get('/reddit/:subreddit', async (c) => {
  const subreddit = c.req.param('subreddit')
  if (!isValidSubreddit(subreddit)) return c.json({ error: 'Invalid subreddit name' }, 400)
  const posts = await fetchRedditPosts(subreddit)
  return c.json({ success: true, posts })
})

app.get('/rss', async (c) => {
  const name = c.req.query('name')
  if (!name) {
    return c.json({
      success: true,
      feeds: POSITIVE_RSS_FEEDS.map(f => ({ name: f.name, category: f.category }))
    })
  }

  // Only feeds from the curated allowlist can be fetched. Accepting an
  // arbitrary URL here would turn this endpoint into an SSRF proxy.
  const feed = POSITIVE_RSS_FEEDS.find(f => f.name.toLowerCase() === name.toLowerCase())
  if (!feed) return c.json({ error: 'Unknown feed' }, 404)

  const posts = await fetchRSSFeed(feed.url, feed.name)
  return c.json({ success: true, posts })
})

/** List the curated content sources that back the feed. */
app.get('/sources', (c) => {
  return c.json({
    success: true,
    sources: {
      reddit: POSITIVE_REDDIT_SUBS,
      devto: POSITIVE_DEVTO_TAGS,
      rss: POSITIVE_RSS_FEEDS.map(f => ({ name: f.name, category: f.category }))
    }
  })
})

// Deep dive moved to here as it's feed related
app.post('/why-this', async (c) => {
  let body: any
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const { title, reason, lang = 'en' } = body || {}
  if (!title) return c.json({ error: 'Title is required' }, 400)

  const deepDive = await generateAIDeepDive(
    sanitizeHtml(title, 200),
    sanitizeHtml(reason || '', 200),
    lang === 'sw' ? 'sw' : 'en',
    c.env.GROQ_API_KEY
  )
  return c.json({ deepDive })
})

app.get('/daily-digest', async (c) => {
  const lang = c.req.query('lang') === 'sw' ? 'sw' : 'en'
  const streamRequested = c.req.query('stream') === 'true'
  const category = c.req.query('category')
  const minScore = parseBoundedInt(c.req.query('minScore'), 0, 0, 10)

  // The streak is tied to a real session, never to a client-supplied user id.
  const session = await getSessionUser(c)

  const cacheKey = `digest-${lang}-v3-${new Date().toISOString().split('T')[0]}-${category || 'all'}-${minScore}`
  const cached = await c.env.UPLIFT_CACHE?.get(cacheKey, 'json') as any
  if (cached && !streamRequested) return c.json({ ...cached, cached: true })

  const posts = await fetchAllSources(c.env)
  let filteredPosts = posts

  if (category) filteredPosts = filteredPosts.filter(p => p.category === category)
  if (minScore > 0) filteredPosts = filteredPosts.filter(p => p.positivityScore >= minScore)

  filteredPosts.sort((a, b) => {
    if (b.positivityScore !== a.positivityScore) return b.positivityScore - a.positivityScore
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  })

  const topPosts = filteredPosts.slice(0, 12)
  const topTitles = topPosts.map(p => p.title)

  let userData = null
  if (session && c.env.DB) {
    try {
      const today = new Date().toISOString().split('T')[0]
      const user = await c.env.DB.prepare("SELECT streak, last_visit FROM users WHERE id = ?").bind(session.id).first() as any

      let newStreak = user?.streak || 0
      if (user?.last_visit !== today) {
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
        newStreak = (user?.last_visit === yesterday) ? newStreak + 1 : 1
        const level = newStreak >= 7 ? 'Joy Guardian' : newStreak >= 3 ? 'Joy Seeker' : 'Uplift Explorer'
        await c.env.DB.prepare("UPDATE users SET streak = ?, last_visit = ?, level = ? WHERE id = ?")
          .bind(newStreak, today, level, session.id).run()
      }
      userData = { streak: newStreak, lastVisit: today }
    } catch (error) { console.error('User streak update error:', error) }
  }

  const introText = await generateDailyIntro(lang, topTitles, c.env.GROQ_API_KEY)

  const digest = { posts: topPosts, intro: introText, generatedAt: new Date().toISOString(), lang, category, minScore, total: filteredPosts.length, userData }
  await c.env.UPLIFT_CACHE?.put(cacheKey, JSON.stringify(digest), { expirationTtl: 86400 })

  if (!streamRequested) return c.json({ ...digest, cached: false })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'start', lang, userData })}\n\n`))
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'intro', text: introText })}\n\n`))
        for (const post of topPosts) {
          await new Promise(resolve => setTimeout(resolve, 100))
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'post', post })}\n\n`))
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'end', digest })}\n\n`))
        controller.close()
      } catch (error) { controller.close() }
    }
  })

  // Reflect the caller's origin only when it is allowlisted — a wildcard
  // origin is invalid alongside credentialed requests.
  const allowedOrigin = corsOriginFor(c.env, c.req.header('Origin'))
  const corsHeaders: Record<string, string> = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Vary': 'Origin'
  }
  if (allowedOrigin) {
    corsHeaders['Access-Control-Allow-Origin'] = allowedOrigin
    corsHeaders['Access-Control-Allow-Credentials'] = 'true'
  }

  return new Response(stream, { headers: corsHeaders })
})

export default app
