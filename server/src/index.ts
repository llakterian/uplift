import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import type { KVNamespace } from '@cloudflare/workers-types'

// Types
interface FeedItem {
  id: string
  title: string
  content: string
  source: string
  sourceName: string
  sourceUrl: string
  author: string
  publishedAt: string
  positivityScore: number
  category: string
  thumbnail?: string
}

interface Env {
  GROQ_API_KEY: string
  UPLIFT_CACHE: KVNamespace
}

const app = new Hono<{ Bindings: Env }>()

// Middleware
app.use('*', logger())
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST'],
  allowHeaders: ['Content-Type'],
}))

// Rate limiter
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

function checkRateLimit(key: string, limit: number, windowSeconds: number): boolean {
  const now = Date.now()
  const record = rateLimitStore.get(key)
  
  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowSeconds * 1000 })
    return true
  }
  
  if (record.count >= limit) {
    return false
  }
  
  record.count++
  return true
}

app.use('*', async (c, next) => {
  const ip = c.req.header('CF-Connecting-IP') || 'unknown'
  if (!checkRateLimit(ip, 30, 60)) {
    return c.json({ error: 'Rate limit exceeded' }, 429)
  }
  await next()
})

// Reddit sources to fetch
const POSITIVE_REDDIT_SUBS = [
  'UpliftingNews',
  'GoodNews',
  'HumansBeingBros',
  'MadeMeSmile',
  'aww',
  'ScienceParenting'
]

// RSS feeds for positive news
const POSITIVE_RSS_FEEDS = [
  { name: 'Good News Network', url: 'https://www.goodnewsnetwork.org/feed/' },
  { name: 'Positive News', url: 'https://www.positive.news/feed/' }
]

// Fetch from Reddit
async function fetchRedditPosts(subreddit: string): Promise<FeedItem[]> {
  try {
    const response = await fetch(`https://www.reddit.com/r/${subreddit}/hot.json?limit=15`, {
      headers: { 'User-Agent': 'Uplift/1.0' }
    })
    
    if (!response.ok) return []
    
    const data = await response.json() as any
    const posts = data.data?.children || []
    
    return posts.map((post: any) => ({
      id: `reddit-${post.data.id}`,
      title: post.data.title || '',
      content: post.data.selftext?.substring(0, 500) || '',
      source: 'reddit',
      sourceName: `r/${subreddit}`,
      sourceUrl: `https://reddit.com${post.data.permalink}`,
      author: post.data.author || 'anonymous',
      publishedAt: new Date(post.data.created_utc * 1000).toISOString(),
      positivityScore: 7, // Default high score for these subs
      category: categorizeFromTitle(post.data.title || ''),
      thumbnail: post.data.thumbnail?.startsWith('http') ? post.data.thumbnail : undefined
    }))
  } catch (error) {
    console.error(`Error fetching r/${subreddit}:`, error)
    return []
  }
}

// Fetch from RSS
async function fetchRSSFeed(feedUrl: string, feedName: string): Promise<FeedItem[]> {
  try {
    const response = await fetch(feedUrl, {
      headers: { 'User-Agent': 'Uplift/1.0' }
    })
    
    if (!response.ok) return []
    
    const xml = await response.text()
    const items = parseRSSItems(xml)
    
    return items.slice(0, 10).map((item: any, index: number) => ({
      id: `rss-${feedName.toLowerCase().replace(/\s/g, '-')}-${index}`,
      title: item.title || '',
      content: item.contentSnippet || item.content || '',
      source: 'rss',
      sourceName: feedName,
      sourceUrl: item.link || '',
      author: item.author || feedName,
      publishedAt: item.pubDate || new Date().toISOString(),
      positivityScore: 7,
      category: categorizeFromTitle(item.title || '')
    }))
  } catch (error) {
    console.error(`Error fetching RSS ${feedName}:`, error)
    return []
  }
}

// Parse RSS XML
function parseRSSItems(xmlText: string): any[] {
  const items: any[] = []
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi
  let match
  
  while ((match = itemRegex.exec(xmlText)) !== null) {
    const itemXml = match[1]
    
    const getTag = (tag: string): string => {
      const regex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')
      const m = itemXml.match(regex)
      return m ? (m[1] || m[2] || '').trim() : ''
    }
    
    items.push({
      title: getTag('title'),
      link: getTag('link'),
      content: getTag('content:encoded') || getTag('description'),
      contentSnippet: getTag('description'),
      pubDate: getTag('pubDate'),
      author: getTag('author') || getTag('dc:creator')
    })
  }
  
  return items
}

// Categorize from title
function categorizeFromTitle(title: string): string {
  const lower = title.toLowerCase()
  
  if (lower.includes('science') || lower.includes('research') || lower.includes('study')) {
    return 'science'
  }
  if (lower.includes('health') || lower.includes('medical') || lower.includes('doctor')) {
    return 'health'
  }
  if (lower.includes('animal') || lower.includes('dog') || lower.includes('cat') || lower.includes('rescue')) {
    return 'animals'
  }
  if (lower.includes('community') || lower.includes('volunteer') || lower.includes('helping')) {
    return 'community'
  }
  if (lower.includes('inspire') || lower.includes('amazing') || lower.includes('incredible')) {
    return 'inspiration'
  }
  
  return 'inspiration'
}

// Groq AI Classification
async function classifyWithAI(items: FeedItem[], apiKey: string): Promise<FeedItem[]> {
  if (!apiKey || items.length === 0) {
    return items
  }
  
  try {
    const titles = items.map(i => `${i.id}: ${i.title}`).join('\n')
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: `You are a positivity classifier. For each news title, classify it as:
- POSITIVE (score 8-10): Good news, inspiring, scientific breakthroughs, community wins, happy moments, acts of kindness
- NEUTRAL (score 5-7): Informational, news without strong emotion
- NEGATIVE (score 1-4): Sad, tragic, anxiety-inducing, doom-scrolling content

Return JSON array with scores for each item in format: [{"id": "item-id", "score": 8}]`
          },
          {
            role: 'user',
            content: `Classify these news titles:\n${titles}`
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      })
    })
    
    if (!response.ok) {
      console.error('Groq API error:', response.status)
      return items
    }
    
    const data = await response.json() as any
    const content = data.choices?.[0]?.message?.content || ''
    
    // Parse scores from response
    const scoresMatch = content.match(/\[[\s\S]*\]/)
    if (scoresMatch) {
      const scores = JSON.parse(scoresMatch[0])
      const scoreMap = new Map(scores.map((s: any) => [s.id, s.score]))
      
      return items.map(item => ({
        ...item,
        positivityScore: scoreMap.get(item.id) || item.positivityScore
      }))
    }
    
    return items
  } catch (error) {
    console.error('AI classification error:', error)
    return items
  }
}

// Cache helper
async function getCachedFeed(kv: KVNamespace | undefined, key: string): Promise<FeedItem[] | null> {
  if (!kv) return null
  
  try {
    const cached = await kv.get(key)
    if (cached) {
      return JSON.parse(cached)
    }
  } catch (e) {
    console.error('Cache read error:', e)
  }
  return null
}

async function setCachedFeed(kv: KVNamespace | undefined, key: string, data: FeedItem[]): Promise<void> {
  if (!kv) return
  
  try {
    await kv.put(key, JSON.stringify(data), { expirationTtl: 600 }) // 10 min cache
  } catch (e) {
    console.error('Cache write error:', e)
  }
}

// Routes

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'healthy', timestamp: new Date().toISOString() })
})

// Get aggregated feed
app.get('/api/feed', async (c) => {
  const category = c.req.query('category')
  const minScore = parseInt(c.req.query('minScore') || '0')
  
  const cacheKey = `feed:${category || 'all'}:${minScore}`
  const cached = await getCachedFeed(c.env.UPLIFT_CACHE, cacheKey)
  
  if (cached) {
    return c.json({ success: true, posts: cached, cached: true })
  }
  
  // Fetch from all sources in parallel
  const [redditResults, rssResults] = await Promise.all([
    Promise.all(POSITIVE_REDDIT_SUBS.map(fetchRedditPosts)),
    Promise.all(POSITIVE_RSS_FEEDS.map(f => fetchRSSFeed(f.url, f.name)))
  ])
  
  let allPosts = [
    ...redditResults.flat(),
    ...rssResults.flat()
  ]
  
  // Classify with AI
  const groqKey = c.env.GROQ_API_KEY
  if (groqKey) {
    allPosts = await classifyWithAI(allPosts.slice(0, 30), groqKey) // Limit to 30 for API
  }
  
  // Apply filters
  if (category) {
    allPosts = allPosts.filter(p => p.category === category)
  }
  
  if (minScore > 0) {
    allPosts = allPosts.filter(p => p.positivityScore >= minScore)
  }
  
  // Sort by score and date
  allPosts.sort((a, b) => {
    if (b.positivityScore !== a.positivityScore) {
      return b.positivityScore - a.positivityScore
    }
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  })
  
  // Limit to 50
  allPosts = allPosts.slice(0, 50)
  
  // Cache the result
  await setCachedFeed(c.env.UPLIFT_CACHE, cacheKey, allPosts)
  
  return c.json({ success: true, posts: allPosts, cached: false })
})

// Get single source
app.get('/api/feed/reddit/:subreddit', async (c) => {
  const subreddit = c.req.param('subreddit')
  const posts = await fetchRedditPosts(subreddit)
  return c.json({ success: true, posts })
})

app.get('/api/feed/rss', async (c) => {
  const name = c.req.query('name')
  const feed = name 
    ? POSITIVE_RSS_FEEDS.filter(f => f.name.toLowerCase().includes(name.toLowerCase()))
    : POSITIVE_RSS_FEEDS
  
  const posts = await Promise.all(feed.map(f => fetchRSSFeed(f.url, f.name)))
  return c.json({ success: true, posts: posts.flat() })
})

// Get available categories
app.get('/api/categories', (c) => {
  return c.json({
    success: true,
    categories: [
      { id: 'science', label: 'Science' },
      { id: 'health', label: 'Health' },
      { id: 'animals', label: 'Animals' },
      { id: 'community', label: 'Community' },
      { id: 'inspiration', label: 'Inspiration' }
    ]
  })
})

export default app
