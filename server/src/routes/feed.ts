import { Hono } from 'hono'
import type { Env, FeedItem } from '../types'
import { fetchAllSources, fetchRedditPosts, fetchRSSFeed } from '../services/feed'
import { getCachedFeed, setCachedFeed } from '../services/cache'
import { generateAIDeepDive, generateDailyIntro } from '../services/groq'
import { sanitizeHtml, isValidSubreddit, isValidHttpUrl } from '../services/security'

const app = new Hono<{ Bindings: Env }>()

async function refreshFeedCache(env: Env, category?: string, minScore?: number, page?: number, limit?: number): Promise<void> {
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
    
    const cacheKey = `feed:${category || 'all'}:${minScore || 0}:${page || 1}:${limit || 50}`
    await setCachedFeed(env.UPLIFT_CACHE, cacheKey, allPosts)
  } catch (error) {
    console.error('Background cache refresh failed:', error)
  }
}

app.get('/', async (c) => {
  const category = c.req.query('category')
  const minScore = parseInt(c.req.query('minScore') || '0')
  const page = parseInt(c.req.query('page') || '1')
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100)

  const cacheKey = `feed:${category || 'all'}:${minScore}:${page}:${limit}`
  const cached = await getCachedFeed(c.env.UPLIFT_CACHE, cacheKey)

  if (cached) {
    const cacheAge = Date.now() - (cached[0]?._cachedAt ? new Date(cached[0]._cachedAt).getTime() : 0)
    if (cacheAge > 5 * 60 * 1000) {
      c.executionCtx?.waitUntil?.(refreshFeedCache(c.env, category, minScore, page, limit))
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
  // We'd import POSITIVE_RSS_FEEDS here but for simplicity we just fetch the provided URL if valid
  return c.json({ error: 'RSS direct fetch not implemented in this route yet. Use /api/feed' })
})

// Deep dive moved to here as it's feed related
app.post('/why-this', async (c) => {
  const { title, reason, lang = 'en' } = await c.req.json()
  if (!title) return c.json({ error: 'Title is required' }, 400)
  const deepDive = await generateAIDeepDive(
    sanitizeHtml(title, 200),
    sanitizeHtml(reason, 200),
    lang === 'sw' ? 'sw' : 'en',
    c.env.GROQ_API_KEY
  )
  return c.json({ deepDive })
})

app.get('/daily-digest', async (c) => {
  const lang = c.req.query('lang') === 'sw' ? 'sw' : 'en'
  const streamRequested = c.req.query('stream') === 'true'
  const category = c.req.query('category')
  const minScore = parseInt(c.req.query('minScore') || '0')
  const userId = c.req.header('X-User-Id')
  
  const cacheKey = `digest-${lang}-v2-${new Date().toISOString().split('T')[0]}-${category || 'all'}-${minScore}`
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
  if (userId && c.env.DB) {
    try {
      const today = new Date().toISOString().split('T')[0]
      const user = await c.env.DB.prepare("SELECT streak, last_visit FROM users WHERE id = ?").bind(userId).first() as any
      
      let newStreak = user?.streak || 0
      if (user?.last_visit !== today) {
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
        newStreak = (user?.last_visit === yesterday) ? newStreak + 1 : 1
        const level = newStreak >= 7 ? 'Joy Guardian' : newStreak >= 3 ? 'Joy Seeker' : 'Uplift Explorer'
        await c.env.DB.prepare("UPDATE users SET streak = ?, last_visit = ?, level = ? WHERE id = ?").bind(newStreak, today, level, userId).run()
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
  
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Credentials': 'true' } })
})

export default app
