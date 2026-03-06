import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import type { KVNamespace } from '@cloudflare/workers-types'

// Security: HTML sanitization helper to prevent XSS from external sources
function sanitizeHtml(text: string): string {
  if (!text) return ''
  return text
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/javascript:/gi, '')
    .trim()
}

// Security: Validate subreddit name to prevent path traversal
function isValidSubreddit(name: string): boolean {
  return /^[a-zA-Z0-9_]{1,21}$/.test(name)
}

// Security: Validate URL to prevent SSRF
function isValidHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

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
  sourceIcon?: string
  tags: string[]
  _cachedAt?: string // Internal tracking for cache age
}

interface Env {
  GROQ_API_KEY: string
  X_BEARER_TOKEN?: string  // Optional: X API access
  UPLIFT_CACHE: KVNamespace
}

const app = new Hono<{ Bindings: Env }>()

// Middleware
app.use('*', logger())
app.use('*', cors({
  origin: (origin) => {
    // Security: Restrict to known origins. In production, set ALLOWED_ORIGINS env var
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://uplift.news,https://www.uplift.news,http://localhost:5173').split(',')
    if (!origin || allowedOrigins.includes(origin)) {
      return origin || allowedOrigins[0]
    }
    return null
  },
  allowMethods: ['GET', 'POST'],
  allowHeaders: ['Content-Type'],
}))

// Security: KV-based rate limiting for distributed edge workers
async function checkRateLimitKV(kv: KVNamespace | undefined, key: string, limit: number, windowSeconds: number): Promise<boolean> {
  if (!kv) return true // Allow if KV not configured
  
  const now = Math.floor(Date.now() / 1000)
  const windowStart = now - windowSeconds
  const recordKey = `ratelimit:${key}`
  
  try {
    const record = await kv.get(recordKey)
    let requests: number[] = []
    
    if (record) {
      requests = JSON.parse(record).filter((ts: number) => ts > windowStart)
    }
    
    if (requests.length >= limit) {
      return false
    }
    
    requests.push(now)
    await kv.put(recordKey, JSON.stringify(requests), { expirationTtl: windowSeconds })
    return true
  } catch (e) {
    console.error('Rate limit check error:', e)
    return true // Allow on error to prevent lockouts
  }
}

app.use('*', async (c, next) => {
  const ip = c.req.header('CF-Connecting-IP') || 'unknown'
  if (!(await checkRateLimitKV(c.env.UPLIFT_CACHE, ip, 30, 60))) {
    return c.json({ error: 'Rate limit exceeded' }, 429)
  }
  await next()
})

// Reddit sources to fetch - expanded with more positive communities
const POSITIVE_REDDIT_SUBS = [
  'UpliftingNews',
  'GoodNews',
  'HumansBeingBros',
  'MadeMeSmile',
  'aww',
  'ScienceParenting',
  'Science',
  'wholesomememes',
  'happycowgifs',
  'Eyebleach',
  'BeAmazed',
  'interestingasfuck',
  'Damnthatsinteresting',
  'NatureIsFuckingLit',
  'PartyParrot',
  'Catswhoyell',
  'BeforeNAfterAdoption',
  'TippyTaps'
]

// Dev.to tags to fetch - expanded
const POSITIVE_DEVTO_TAGS = ['beginners', 'productivity', 'career', 'motivation', 'learning', 'opensource']

// Mastodon tags/instances - expanded
const MASTODON_INSTANCES = [
  { instance: 'mastodon.social', tag: 'goodnews' },
  { instance: 'mastodon.social', tag: 'uplift' },
  { instance: 'mastodon.social', tag: 'photography' },
  { instance: 'fosstodon.org', tag: 'science' },
  { instance: 'mastodon.social', tag: 'nature' },
  { instance: 'mastodon.social', tag: 'art' }
]

// RSS feeds for positive news - expanded with better sources
const POSITIVE_RSS_FEEDS = [
  { name: 'Good News Network', url: 'https://www.goodnewsnetwork.org/feed/', category: 'general' },
  { name: 'Positive News', url: 'https://www.positive.news/feed/', category: 'general' },
  { name: 'Upworthy', url: 'https://www.upworthy.com/rss', category: 'inspiration' },
  { name: 'The Happy Broadcast', url: 'https://www.thehappybroadcast.com/rss', category: 'general' },
  { name: 'BBC Good News', url: 'https://feeds.bbci.co.uk/news/happy/feed.xml', category: 'general' },
  { name: 'Treehugger', url: 'https://www.treehugger.com/feeds/latest.rss', category: 'environment' },
  { name: 'National Geographic', url: 'https://www.nationalgeographic.com/rss', category: 'science' },
  { name: 'Kottke', url: 'https://feeds.kottke.org/main', category: 'culture' },
  { name: 'Aptitude', url: 'https://www.aptitude.com/feed', category: 'tech' },
  { name: 'Bright Side', url: 'https://brightside.me/rss', category: 'inspiration' }
]

// Hacker News "Show HN" - for inspiring tech projects
const HACKER_NEWS_URL = 'https://hacker-news.firebaseio.com/v0/'

// GitHub Trending repositories - for positive tech content
const GITHUB_TRENDING_URLS = [
  'https://api.github.com/search/repositories?q=stars:>100+created:>2025-01-01&sort=stars&order=desc&per_page=10'
]

// Bluesky configuration - FREE API, no auth required for public feeds
const BLUESKY_POSITIVE_FEEDS = [
  { did: 'did:plc:z72i7hdat', feed: 'whats-hot', name: 'Popular' },
  { did: 'did:plc:vpkhqolt662', feed: 'good-news', name: 'Good News' }
]

// YouTube channels with positive content (using RSS feeds - FREE)
const YOUTUBE_CHANNELS = [
  { id: 'UCX6OQ3DkcsbYNE6H8uQQuVA', name: 'MrBeast' },
  { id: 'UCbCmjCuTUZos6Inko4u57UQ', name: 'Cinema Therapy' },
  { id: 'UCsooa4yRKGN_zEE8iknghZA', name: 'TED-Ed' },
  { id: 'UCL5YbN5WLFD8dVegynDf8Rw', name: 'Nas Daily' },
  { id: 'UCJIfeSCzM6ST-ZTjNZU1jRw', name: 'Goodful' }
]

// Nostr relay URLs - FREE, decentralized
const NOSTR_RELAYS = [
  'wss://relay.damus.io',
  'wss://nostr.mom',
  'wss://relay.nostr.band'
]

// Nostr positive hashtags to track
const NOSTR_POSITIVE_TAGS = ['goodnews', 'uplifting', 'kindness', 'gratitude', 'blessed']

// X search queries for positive content (optional - requires paid API)
const X_POSITIVE_QUERIES = [
  '"good news" lang:en -is:retweet',
  '"wholesome moment" lang:en -is:retweet', 
  '"made me smile" lang:en -is:retweet',
  '"restores my faith in humanity" lang:en -is:retweet',
  '"congratulations" "proud of you" lang:en -is:retweet'
]

// Fetch from Bluesky - FREE API, no auth required
async function fetchBlueskyFeed(did: string, feedName: string, feedDisplayName: string): Promise<FeedItem[]> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    
    const response = await fetch(
      `https://api.bsky.app/xrpc/app.bsky.feed.getFeed?feed=at://${did}/app.bsky.feed.generator/${feedName}&limit=20`,
      { signal: controller.signal }
    )
    clearTimeout(timeout)
    
    if (!response.ok) {
      console.error(`Bluesky API error for ${feedName}:`, response.status)
      return []
    }
    
    const data = await response.json() as any
    const posts = data.feed || []
    
    return posts.map((item: any) => {
      const post = item.post
      const author = post?.author
      const record = post?.record
      
      // Extract image from embed
      let thumbnail: string | undefined = undefined
      if (post?.embed?.images?.[0]?.thumb) {
        thumbnail = post.embed.images[0].thumb
      } else if (post?.embed?.external?.thumb) {
        thumbnail = post.embed.external.thumb
      }
      
      return {
        id: `bluesky-${post?.uri?.split('/').pop() || Math.random().toString(36)}`,
        title: sanitizeHtml(record?.text)?.substring(0, 100) + '...' || '',
        content: sanitizeHtml(record?.text) || '',
        source: 'bluesky',
        sourceName: `Bluesky / ${feedDisplayName}`,
        sourceUrl: `https://bsky.app/profile/${author?.handle}/post/${post?.uri?.split('/').pop()}`,
        author: sanitizeHtml(author?.displayName) || sanitizeHtml(author?.handle) || 'anonymous',
        publishedAt: record?.createdAt || new Date().toISOString(),
        positivityScore: 7,
        category: categorizeFromTitle(record?.text || ''),
        thumbnail,
        sourceIcon: 'https://bsky.app/static/favicon.png',
        tags: ['bluesky', 'social']
      }
    })
  } catch (error) {
    console.error(`Error fetching Bluesky ${feedName}:`, error)
    return []
  }
}

// Fetch from YouTube via RSS - FREE, no API key needed
async function fetchYouTubeRSS(channelId: string, channelName: string): Promise<FeedItem[]> {
  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
  
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    
    const response = await fetch(feedUrl, {
      headers: { 'User-Agent': 'Uplift/1.0' },
      signal: controller.signal
    })
    clearTimeout(timeout)
    
    if (!response.ok) return []
    
    const xml = await response.text()
    const parser = new XMLParser(xml)
    const entries = parser.getElementsByTagName('entry')
    
    return entries.slice(0, 10).map((entry: any, index: number) => {
      const getText = (tag: string) => {
        const el = entry.getElementsByTagName(tag)[0]
        return el ? el.textContent : ''
      }
      
      const videoId = entry.getElementsByTagName('yt:videoId')[0]?.textContent || 
                      entry.xml?.match(/<yt:videoId>([^<]+)/)?.[1] || 
                      `yt-${index}`
      
      const title = getText('title')
      const published = getText('published')
      
      // YouTube thumbnail URL format
      const thumbnail = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
      
      return {
        id: `youtube-${videoId}`,
        title: sanitizeHtml(title) || '',
        content: `Video from ${channelName}`,
        source: 'youtube',
        sourceName: channelName,
        sourceUrl: `https://youtube.com/watch?v=${videoId}`,
        author: channelName,
        publishedAt: published || new Date().toISOString(),
        positivityScore: 7,
        category: categorizeFromTitle(title),
        thumbnail,
        sourceIcon: 'https://www.youtube.com/favicon.ico',
        tags: ['youtube', 'video']
      }
    })
  } catch (error) {
    console.error(`Error fetching YouTube ${channelName}:`, error)
    return []
  }
}

// Fetch from Nostr - FREE, decentralized
async function fetchNostrEvents(relayUrl: string, tag: string): Promise<FeedItem[]> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    
    // Connect to WebSocket
    const ws = new WebSocket(relayUrl)
    
    const events: any[] = await new Promise((resolve, reject) => {
      const receivedEvents: any[] = []
      const subId = Math.random().toString(36).substring(7)
      
      ws.onopen = () => {
        // Subscribe to hashtag
        ws.send(JSON.stringify([
          'REQ',
          subId,
          { kinds: [1], '#t': [tag], limit: 10 }
        ]))
      }
      
      ws.onmessage = (msg) => {
        const data = JSON.parse(msg.data)
        if (data[0] === 'EVENT' && data[1] === subId) {
          receivedEvents.push(data[2])
        }
        if (data[0] === 'EOSE') {
          ws.close()
          resolve(receivedEvents)
        }
      }
      
      ws.onerror = () => {
        ws.close()
        resolve([])
      }
      
      // Timeout fallback
      setTimeout(() => {
        ws.close()
        resolve(receivedEvents)
      }, 8000)
    })
    
    clearTimeout(timeout)
    
    return events.map((event: any) => {
      // Parse content for images
      const content = event.content || ''
      const thumbnail = extractImageFromContent(content)
      
      return {
        id: `nostr-${event.id?.substring(0, 16) || Math.random().toString(36)}`,
        title: sanitizeHtml(content).substring(0, 100) + '...',
        content: sanitizeHtml(content),
        source: 'nostr',
        sourceName: `Nostr #${tag}`,
        sourceUrl: `https://snort.social/e/${event.id}`,
        author: event.pubkey?.substring(0, 8) || 'anonymous',
        publishedAt: new Date(event.created_at * 1000).toISOString(),
        positivityScore: 7,
        category: categorizeFromTitle(content),
        thumbnail,
        sourceIcon: 'https://nostr.com/favicon.ico',
        tags: ['nostr', tag]
      }
    })
  } catch (error) {
    console.error(`Error fetching Nostr from ${relayUrl}:`, error)
    return []
  }
}

// Fetch from X API v2
async function fetchXPosts(query: string, bearerToken?: string): Promise<FeedItem[]> {
  if (!bearerToken) {
    console.error('X_BEARER_TOKEN not configured')
    return []
  }
  
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    
    // Search recent tweets
    const response = await fetch(
      `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=15&tweet.fields=created_at,author_id,public_metrics&expansions=author_id&user.fields=username,profile_image_url`,
      {
        headers: {
          'Authorization': `Bearer ${bearerToken}`,
          'User-Agent': 'Uplift/1.0'
        },
        signal: controller.signal
      }
    )
    clearTimeout(timeout)
    
    if (!response.ok) {
      console.error('X API error:', response.status)
      return []
    }
    
    const data = await response.json() as any
    const tweets = data.data || []
    const users = new Map((data.includes?.users || []).map((u: any) => [u.id, u]))
    
    return tweets.map((tweet: any) => {
      const author = users.get(tweet.author_id) as any
      return {
        id: `x-${tweet.id}`,
        title: sanitizeHtml(tweet.text).substring(0, 100) + '...',
        content: sanitizeHtml(tweet.text),
        source: 'x',
        sourceName: 'X (Twitter)',
        sourceUrl: `https://x.com/${author?.username || 'i'}/status/${tweet.id}`,
        author: sanitizeHtml(author?.username) || 'anonymous',
        publishedAt: tweet.created_at,
        positivityScore: 7,
        category: categorizeFromTitle(tweet.text),
        thumbnail: author?.profile_image_url || undefined,
        sourceIcon: 'https://abs.twimg.com/favicons/twitter.3.ico',
        tags: ['social']
      }
    })
  } catch (error) {
    console.error('Error fetching X posts:', error)
    return []
  }
}
function extractImageFromContent(content: string, fallbackUrl?: string): string | undefined {
  // Try to find image in HTML content
  const imgMatch = content.match(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/i)
  if (imgMatch && isValidHttpUrl(imgMatch[1])) {
    return imgMatch[1]
  }
  // Try to find image URL in plain text
  const urlMatch = content.match(/(https?:\/\/[^\s"]+\.(?:jpg|jpeg|png|gif|webp))/i)
  if (urlMatch && isValidHttpUrl(urlMatch[1])) {
    return urlMatch[1]
  }
  return fallbackUrl
}

// Extract best available image from Reddit post data
function extractRedditImage(postData: any): string | undefined {
  // Priority: preview.images > url_overridden_by_dest > thumbnail > undefined
  if (postData.preview?.images?.[0]?.source?.url) {
    return postData.preview.images[0].source.url.replace(/&amp;/g, '&')
  }
  if (postData.preview?.images?.[0]?.resolutions?.[0]?.url) {
    return postData.preview.images[0].resolutions[0].url.replace(/&amp;/g, '&')
  }
  if (postData.url_overridden_by_dest && isValidHttpUrl(postData.url_overridden_by_dest)) {
    const url = postData.url_overridden_by_dest
    // Check if it's a direct image link
    if (/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(url)) {
      return url
    }
  }
  if (postData.thumbnail?.startsWith('http')) {
    return postData.thumbnail
  }
  return undefined
}

// Fetch from Reddit with security validations
async function fetchRedditPosts(subreddit: string): Promise<FeedItem[]> {
  // Security: Validate subreddit name before using in URL
  if (!isValidSubreddit(subreddit)) {
    console.error(`Invalid subreddit name: ${subreddit}`)
    return []
  }
  
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000) // 10s timeout
    
    const response = await fetch(`https://www.reddit.com/r/${subreddit}/hot.json?limit=15`, {
      headers: { 'User-Agent': 'Uplift/1.0' },
      signal: controller.signal
    })
    clearTimeout(timeout)

    if (!response.ok) return []

    const data = await response.json() as any
    const posts = data.data?.children || []

    return posts.map((post: any) => ({
      id: `reddit-${post.data.id}`,
      title: sanitizeHtml(post.data.title) || '',
      content: sanitizeHtml(post.data.selftext?.substring(0, 500)) || '',
      source: 'reddit',
      sourceName: `r/${subreddit}`,
      sourceUrl: `https://reddit.com${post.data.permalink}`,
      author: sanitizeHtml(post.data.author) || 'anonymous',
      publishedAt: new Date(post.data.created_utc * 1000).toISOString(),
      positivityScore: 7,
      category: categorizeFromTitle(post.data.title || ''),
      // Enhanced image handling
      thumbnail: extractRedditImage(post.data),
      sourceIcon: 'https://www.redditstatic.com/desktop2x/img/favicon/apple-icon-57x57.png',
      tags: [subreddit.toLowerCase()]
    }))
  } catch (error) {
    console.error(`Error fetching r/${subreddit}:`, error)
    return []
  }
}

// Fetch from RSS with security validations and timeout
async function fetchRSSFeed(feedUrl: string, feedName: string): Promise<FeedItem[]> {
  // Security: Validate URL before fetching
  if (!isValidHttpUrl(feedUrl)) {
    console.error(`Invalid RSS feed URL: ${feedUrl}`)
    return []
  }
  
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000) // 15s timeout for RSS
    
    const response = await fetch(feedUrl, {
      headers: { 'User-Agent': 'Uplift/1.0' },
      signal: controller.signal
    })
    clearTimeout(timeout)

    if (!response.ok) return []

    const xml = await response.text()
    const items = parseRSSItems(xml)

    return items.slice(0, 10).map((item: any, index: number) => ({
      id: `rss-${feedName.toLowerCase().replace(/\s/g, '-')}-${index}`,
      title: sanitizeHtml(item.title) || '',
      content: sanitizeHtml(item.contentSnippet || item.content) || '',
      source: 'rss',
      sourceName: sanitizeHtml(feedName),
      sourceUrl: item.link || '',
      author: sanitizeHtml(item.author) || sanitizeHtml(feedName),
      publishedAt: item.pubDate || new Date().toISOString(),
      positivityScore: 7,
      category: categorizeFromTitle(item.title || ''),
      thumbnail: item.thumbnail || extractImageFromContent(item.content),
      sourceIcon: `https://www.google.com/s2/favicons?domain=${new URL(feedUrl).hostname}&sz=64`,
      tags: []
    }))
  } catch (error) {
    console.error(`Error fetching RSS ${feedName}:`, error)
    return []
  }
}

// Fetch from Dev.to with timeout and sanitization
async function fetchDevToArticles(tag: string): Promise<FeedItem[]> {
  // Security: Validate tag to prevent injection
  if (!/^[a-zA-Z0-9_-]{1,30}$/.test(tag)) {
    console.error(`Invalid Dev.to tag: ${tag}`)
    return []
  }
  
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    
    const response = await fetch(`https://dev.to/api/articles?tag=${encodeURIComponent(tag)}&per_page=10&top=7`, {
      headers: { 'User-Agent': 'Uplift/1.0' },
      signal: controller.signal
    })
    clearTimeout(timeout)

    if (!response.ok) return []

    const articles = await response.json() as any[]

    return articles.map((article: any) => ({
      id: `devto-${article.id}`,
      title: sanitizeHtml(article.title) || '',
      content: sanitizeHtml(article.description) || '',
      source: 'devto',
      sourceName: 'Dev.to',
      sourceUrl: article.url,
      author: sanitizeHtml(article.user?.name) || 'anonymous',
      publishedAt: article.published_at,
      positivityScore: 7,
      category: 'tech',
      tags: article.tag_list || [],
      thumbnail: article.cover_image || undefined,
      sourceIcon: 'https://dev-to-uploads.s3.amazonaws.com/uploads/logos/original_logo_0D1117.png'
    }))
  } catch (error) {
    console.error(`Error fetching Dev.to tag ${tag}:`, error)
    return []
  }
}

// Fetch from Mastodon with timeout and sanitization
async function fetchMastodonPosts(instance: string, tag: string): Promise<FeedItem[]> {
  // Security: Validate instance and tag
  if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]$/.test(instance) || !/^[a-zA-Z0-9_]{1,40}$/.test(tag)) {
    console.error(`Invalid Mastodon params: ${instance}, ${tag}`)
    return []
  }
  
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    
    const response = await fetch(`https://${encodeURIComponent(instance)}/api/v1/timelines/tag/${encodeURIComponent(tag)}?limit=10`, {
      headers: { 'User-Agent': 'Uplift/1.0' },
      signal: controller.signal
    })
    clearTimeout(timeout)

    if (!response.ok) return []

    const posts = await response.json() as any[]

    return posts.map((post: any) => ({
      id: `mastodon-${post.id}`,
      title: sanitizeHtml(post.content).substring(0, 100) + '...',
      content: sanitizeHtml(post.content),
      source: 'mastodon',
      sourceName: instance,
      sourceUrl: post.url,
      author: sanitizeHtml(post.account?.display_name) || sanitizeHtml(post.account?.username) || 'anonymous',
      publishedAt: post.created_at,
      positivityScore: 7,
      category: categorizeFromTitle(post.content),
      tags: post.tags?.map((t: any) => t.name) || [],
      thumbnail: post.media_attachments?.[0]?.url || undefined,
      sourceIcon: `https://www.google.com/s2/favicons?domain=${instance}&sz=64`
    }))
  } catch (error) {
    console.error(`Error fetching Mastodon from ${instance}:`, error)
    return []
  }
}

// Fetch Hacker News "Show HN" posts with improved image handling
async function fetchHackerNewsShow(): Promise<FeedItem[]> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    
    // Get top story IDs
    const response = await fetch(`${HACKER_NEWS_URL}topstories.json`, {
      signal: controller.signal
    })
    clearTimeout(timeout)
    
    if (!response.ok) return []
    
    const storyIds = (await response.json()) as number[]
    const topIds = storyIds.slice(0, 30)
    
    // Fetch details for each story
    const stories = await Promise.all(
      topIds.map(async (id) => {
        try {
          const storyRes = await fetch(`${HACKER_NEWS_URL}item/${id}.json`, {
            signal: controller.signal
          })
          if (!storyRes.ok) return null
          return await storyRes.json()
        } catch {
          return null
        }
      })
    )
    
    // Filter for "Show HN" posts and map to FeedItem
    const validStories = stories.filter((s: any) => s !== null && s !== undefined && s.title && s.title.toLowerCase().includes('show hn'))
    
    return validStories.slice(0, 10).map((story: any) => ({
        id: `hn-${story.id}`,
        title: sanitizeHtml(story.title) || '',
        content: sanitizeHtml(story.text?.substring(0, 300)) || '',
        source: 'hackernews',
        sourceName: 'Hacker News',
        sourceUrl: story.url || `https://news.ycombinator.com/item?id=${story.id}`,
        author: sanitizeHtml(story.by) || 'anonymous',
        publishedAt: new Date(story.time * 1000).toISOString(),
        positivityScore: 7,
        category: 'tech',
        thumbnail: undefined,
        sourceIcon: 'https://news.ycombinator.com/favicon.ico',
        tags: ['show-hn', 'tech']
      }))
  } catch (error) {
    console.error('Error fetching Hacker News:', error)
    return []
  }
}

// Fetch GitHub trending repositories
async function fetchGitHubTrending(): Promise<FeedItem[]> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    
    const response = await fetch(GITHUB_TRENDING_URLS[0], {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Uplift/1.0'
      },
      signal: controller.signal
    })
    clearTimeout(timeout)
    
    if (!response.ok) return []
    
    const data = await response.json() as any
    const repos = data.items || []
    
    return repos.slice(0, 10).map((repo: any) => ({
      id: `github-${repo.id}`,
      title: sanitizeHtml(repo.name) || '',
      content: sanitizeHtml(repo.description) || 'No description available',
      source: 'github',
      sourceName: 'GitHub',
      sourceUrl: repo.html_url,
      author: sanitizeHtml(repo.owner?.login) || 'unknown',
      publishedAt: repo.created_at || new Date().toISOString(),
      positivityScore: 7,
      category: 'tech',
      thumbnail: undefined,
      sourceIcon: 'https://github.com/favicon.ico',
      tags: repo.topics || ['opensource']
    }))
  } catch (error) {
    console.error('Error fetching GitHub trending:', error)
    return []
  }
}
function parseRSSItems(xmlText: string): any[] {
  const items: any[] = []
  
  try {
    // Use a more secure parsing approach
    const parser = new XMLParser(xmlText)
    const channel = parser.getElementsByTagName('channel')[0]
    const itemElements = parser.getElementsByTagName('item')
    
    for (const itemEl of itemElements) {
      const getText = (tagName: string): string => {
        const el = itemEl.getElementsByTagName(tagName)[0]
        return el ? sanitizeHtml(el.textContent || '') : ''
      }
      
      items.push({
        title: getText('title'),
        link: getText('link'),
        content: getText('content:encoded') || getText('description'),
        contentSnippet: getText('description'),
        pubDate: getText('pubDate'),
        author: getText('author') || getText('dc:creator')
      })
    }
  } catch (e) {
    console.error('RSS parse error:', e)
    // Fallback: return empty rather than crash
  }
  
  return items
}

// Security: Simple XML parser class to replace regex-based parsing
// Uses a lightweight tag-based approach safe from ReDoS
class XMLParser {
  private xmlText: string
  
  constructor(xmlText: string) {
    this.xmlText = xmlText
  }
  
  // Safe extraction of tag content without regex
  private extractTagContent(tagName: string, parentXml: string): string {
    const startTag = `<${tagName}`
    const startIndex = parentXml.indexOf(startTag)
    if (startIndex === -1) return ''
    
    const tagEnd = parentXml.indexOf('>', startIndex)
    if (tagEnd === -1) return ''
    
    const contentStart = tagEnd + 1
    const endTag = `</${tagName}>`
    const endIndex = parentXml.indexOf(endTag, contentStart)
    if (endIndex === -1) return ''
    
    let content = parentXml.substring(contentStart, endIndex)
    
    // Handle CDATA
    if (content.includes('<![CDATA[')) {
      const cdataStart = content.indexOf('<![CDATA[') + 9
      const cdataEnd = content.indexOf(']]>', cdataStart)
      if (cdataEnd !== -1) {
        content = content.substring(cdataStart, cdataEnd)
      }
    }
    
    return content.trim()
  }
  
  getElementsByTagName(name: string): Element[] {
    const elements: Element[] = []
    let searchIndex = 0
    
    while (true) {
      const startIndex = this.xmlText.indexOf(`<${name}`, searchIndex)
      if (startIndex === -1) break
      
      const endTag = `</${name}>`
      const endIndex = this.xmlText.indexOf(endTag, startIndex)
      if (endIndex === -1) break
      
      const elementXml = this.xmlText.substring(startIndex, endIndex + endTag.length)
      elements.push(new Element(elementXml, name, this))
      searchIndex = endIndex + endTag.length
    }
    
    return elements
  }
  
  getText(): string {
    return this.xmlText
  }
}

class Element {
  private xml: string
  private tagName: string
  private parser: XMLParser
  
  constructor(xml: string, tagName: string, parser: XMLParser) {
    this.xml = xml
    this.tagName = tagName
    this.parser = parser
  }
  
  getElementsByTagName(name: string): Element[] {
    const elements: Element[] = []
    // Find content between this element's opening and closing tags
    const startTag = `<${this.tagName}`
    const endTag = `</${this.tagName}>`
    const contentStart = this.xml.indexOf('>') + 1
    const contentEnd = this.xml.lastIndexOf(endTag)
    
    if (contentStart >= contentEnd) return []
    
    const content = this.xml.substring(contentStart, contentEnd)
    
    let searchIndex = 0
    while (true) {
      const startIndex = content.indexOf(`<${name}`, searchIndex)
      if (startIndex === -1) break
      
      const childEndTag = `</${name}>`
      const endIndex = content.indexOf(childEndTag, startIndex)
      if (endIndex === -1) break
      
      const childXml = content.substring(startIndex, endIndex + childEndTag.length)
      elements.push(new Element(childXml, name, this.parser))
      searchIndex = endIndex + childEndTag.length
    }
    
    return elements
  }
  
  get textContent(): string {
    const contentStart = this.xml.indexOf('>') + 1
    const endTag = `</${this.tagName}>`
    const contentEnd = this.xml.lastIndexOf(endTag)
    
    if (contentStart >= contentEnd) return ''
    
    let content = this.xml.substring(contentStart, contentEnd)
    
    // Handle CDATA
    if (content.includes('<![CDATA[')) {
      const cdataStart = content.indexOf('<![CDATA[') + 9
      const cdataEnd = content.indexOf(']]>', cdataStart)
      if (cdataEnd !== -1) {
        content = content.substring(cdataStart, cdataEnd)
      }
    }
    
    return content.trim()
  }
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

  if (lower.includes('tech') || lower.includes('software') || lower.includes('code') || lower.includes('ai')) {
    return 'tech'
  }

  return 'inspiration'
}

// Security: Validate API key format
function isValidApiKey(key: string): boolean {
  // Groq API keys are typically 56 characters starting with gsk_
  return /^gsk_[a-zA-Z0-9]{52}$/.test(key)
}
async function classifyWithAI(items: FeedItem[], apiKey: string): Promise<FeedItem[]> {
  // Security: Validate API key format before use
  if (!apiKey || !isValidApiKey(apiKey) || items.length === 0) {
    console.error('Invalid or missing Groq API key')
    return items
  }

  try {
    const titles = items.map(i => `${i.id}: ${i.title}`).join('\n')

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000) // 30s timeout for AI
    
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
      }),
      signal: controller.signal
    })
    clearTimeout(timeout)

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
      const scoreMap = new Map<string, number>(scores.map((s: any) => [s.id, s.score]))

      return items.map(item => {
        const aiScore = scoreMap.get(item.id);
        return {
          ...item,
          positivityScore: typeof aiScore === 'number' ? aiScore : item.positivityScore
        };
      })

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

// Get aggregated feed with improved caching and performance
app.get('/api/feed', async (c) => {
  const category = c.req.query('category')
  const minScore = parseInt(c.req.query('minScore') || '0')
  const page = parseInt(c.req.query('page') || '1')
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100) // Max 100 items

  const cacheKey = `feed:${category || 'all'}:${minScore}:${page}:${limit}`
  const cached = await getCachedFeed(c.env.UPLIFT_CACHE, cacheKey)

  // Return stale cache immediately while refreshing in background
  if (cached) {
    // Trigger background refresh if cache is older than 5 minutes
    const cacheAge = Date.now() - (cached[0]?._cachedAt ? new Date(cached[0]._cachedAt).getTime() : 0)
    if (cacheAge > 5 * 60 * 1000) {
      // Fire and forget background refresh
      c.executionCtx?.waitUntil?.(refreshFeedCache(c.env, category, minScore, page, limit))
    }
    
    // Apply pagination to cached results
    const start = (page - 1) * limit
    const paginatedPosts = cached.slice(start, start + limit)
    
    return c.json({ 
      success: true, 
      posts: paginatedPosts, 
      cached: true,
      pagination: {
        page,
        limit,
        total: cached.length
      }
    })
  }

  // Fetch fresh data
  const posts = await fetchAllSources(c.env)

  // Apply filters
  let allPosts = posts

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

  // Add cache timestamp for stale-while-revalidate
  allPosts = allPosts.map(p => ({ ...p, _cachedAt: new Date().toISOString() }))

  // Cache the full result set
  await setCachedFeed(c.env.UPLIFT_CACHE, cacheKey, allPosts)

  // Apply pagination
  const start = (page - 1) * limit
  const paginatedPosts = allPosts.slice(start, start + limit)

  return c.json({ 
    success: true, 
    posts: paginatedPosts, 
    cached: false,
    pagination: {
      page,
      limit,
      total: allPosts.length
    }
  })
})

// Background refresh function
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

// Fetch all sources helper
async function fetchAllSources(env: Env): Promise<FeedItem[]> {
  const [redditResults, rssResults, devtoResults, mastodonResults, hnResults, githubResults, xResults, blueskyResults, youtubeResults, nostrResults] = await Promise.all([
    Promise.all(POSITIVE_REDDIT_SUBS.map(sub => fetchWithFallback(() => fetchRedditPosts(sub), []))),
    Promise.all(POSITIVE_RSS_FEEDS.map(f => fetchWithFallback(() => fetchRSSFeed(f.url, f.name), []))),
    Promise.all(POSITIVE_DEVTO_TAGS.map(tag => fetchWithFallback(() => fetchDevToArticles(tag), []))),
    Promise.all(MASTODON_INSTANCES.map(m => fetchWithFallback(() => fetchMastodonPosts(m.instance, m.tag), []))),
    fetchWithFallback(fetchHackerNewsShow, []),
    fetchWithFallback(fetchGitHubTrending, []),
    // X (Twitter) - fetch from multiple positive queries (optional, requires API key)
    env.X_BEARER_TOKEN 
      ? Promise.all(X_POSITIVE_QUERIES.map((q: string) => fetchWithFallback(() => fetchXPosts(q, env.X_BEARER_TOKEN), []))).then(r => r.flat())
      : Promise.resolve([]),
    // Bluesky - FREE API
    Promise.all(BLUESKY_POSITIVE_FEEDS.map(feed => fetchWithFallback(() => fetchBlueskyFeed(feed.did, feed.feed, feed.name), []))),
    // YouTube - FREE via RSS
    Promise.all(YOUTUBE_CHANNELS.map(ch => fetchWithFallback(() => fetchYouTubeRSS(ch.id, ch.name), []))),
    // Nostr - FREE, decentralized (sample one tag per relay to avoid overload)
    Promise.all(NOSTR_RELAYS.slice(0, 2).map((relay, i) => fetchWithFallback(() => fetchNostrEvents(relay, NOSTR_POSITIVE_TAGS[i % NOSTR_POSITIVE_TAGS.length]), [])))
  ])

  return [
    ...redditResults.flat(),
    ...rssResults.flat(),
    ...devtoResults.flat(),
    ...mastodonResults.flat(),
    ...hnResults,
    ...githubResults,
    ...xResults,
    ...blueskyResults.flat(),
    ...youtubeResults.flat(),
    ...nostrResults.flat()
  ]
}

// Fetch with fallback wrapper
async function fetchWithFallback<T>(fetcher: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fetcher()
  } catch (error) {
    console.error('Fetcher failed, using fallback:', error)
    return fallback
  }
}

// Image proxy endpoint for resizing and caching images
app.get('/api/image-proxy', async (c) => {
  const url = c.req.query('url')
  const width = parseInt(c.req.query('w') || '400')
  
  if (!url || !isValidHttpUrl(url)) {
    return c.json({ error: 'Invalid image URL' }, 400)
  }
  
  // Validate width parameter
  if (width < 10 || width > 1200) {
    return c.json({ error: 'Width must be between 10 and 1200' }, 400)
  }
  
  const cacheKey = `img:${width}:${url}`
  
  // Try to get from KV cache
  try {
    const cached = await c.env.UPLIFT_CACHE?.get(cacheKey, 'arrayBuffer')
    if (cached) {
      return new Response(cached, {
        headers: {
          'Content-Type': 'image/webp',
          'Cache-Control': 'public, max-age=86400',
          'X-Cache': 'HIT'
        }
      })
    }
  } catch (e) {
    console.error('Cache read error for image:', e)
  }
  
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Uplift/1.0' },
      signal: controller.signal
    })
    clearTimeout(timeout)
    
    if (!response.ok) {
      return c.json({ error: 'Failed to fetch image' }, 502)
    }
    
    const contentType = response.headers.get('Content-Type') || 'image/jpeg'
    
    // Only proxy image content types
    if (!contentType.startsWith('image/')) {
      return c.json({ error: 'URL is not an image' }, 400)
    }
    
    const imageBuffer = await response.arrayBuffer()
    
    // Cache the image (24 hour expiry)
    try {
      await c.env.UPLIFT_CACHE?.put(cacheKey, imageBuffer, { expirationTtl: 86400 })
    } catch (e) {
      console.error('Cache write error for image:', e)
    }
    
    return new Response(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        'X-Cache': 'MISS'
      }
    })
  } catch (error) {
    console.error('Image proxy error:', error)
    return c.json({ error: 'Failed to proxy image' }, 502)
  }
})

// Get single source with validation
app.get('/api/feed/reddit/:subreddit', async (c) => {
  const subreddit = c.req.param('subreddit')
  
  // Security: Validate subreddit name
  if (!isValidSubreddit(subreddit)) {
    return c.json({ error: 'Invalid subreddit name' }, 400)
  }
  
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
      { id: 'science', label: 'Science', icon: 'microscope' },
      { id: 'health', label: 'Health', icon: 'heart-pulse' },
      { id: 'animals', label: 'Animals', icon: 'paw-print' },
      { id: 'community', label: 'Community', icon: 'users' },
      { id: 'inspiration', label: 'Inspiration', icon: 'sparkles' },
      { id: 'tech', label: 'Technology', icon: 'cpu' },
      { id: 'environment', label: 'Environment', icon: 'leaf' },
      { id: 'culture', label: 'Culture', icon: 'palette' }
    ]
  })
})

export default app
