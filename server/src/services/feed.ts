import type { Env, FeedItem } from '../types'
import { sanitizeHtml, isValidSubreddit, isValidHttpUrl } from './security'

// ---------------------------------------------------------------------------
// Text cleaning helpers
// ---------------------------------------------------------------------------

function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&mdash;/g, '\u2014')
    .replace(/&ndash;/g, '\u2013')
    .replace(/&hellip;/g, '\u2026')
    .replace(/&lsquo;/g, '\u2018')
    .replace(/&rsquo;/g, '\u2019')
    .replace(/&ldquo;/g, '\u201C')
    .replace(/&rdquo;/g, '\u201D')
}

function stripBoilerplate(text: string): string {
  return text
    .replace(/The post .{1,150} appeared first on .{1,80}\.?\s*$/i, '')
    .replace(/\[\s*&hellip;\s*\]/g, '\u2026')
    .replace(/\[\s*\u2026\s*\]/g, '\u2026')
    .trim()
}

function scorePositivity(title: string, content: string): number {
  const text = `${title} ${content}`.toLowerCase()
  const positiveWords = ['good news', 'breakthrough', 'cure', 'rescue', 'saved', 'hero', 'inspiring', 'amazing', 'incredible', 'milestone', 'record-breaking', 'healing', 'volunteer', 'donate', 'hope', 'joy', 'celebrate', 'miracle', 'success', 'discovered', 'innovation', 'progress', 'solution', 'thriving', 'recovery', 'uplift', 'positive', 'beautiful', 'kindness', 'compassion', 'generosity']
  const negativeWords = ['death', 'killed', 'murder', 'war', 'disaster', 'crisis', 'crash', 'tragic', 'corruption', 'scandal', 'abuse', 'terror', 'attack', 'victim', 'violence', 'shooting', 'bomb', 'threat', 'bankrupt', 'collapse']
  let score = 6
  for (const w of positiveWords) if (text.includes(w)) score += 0.5
  for (const w of negativeWords) if (text.includes(w)) score -= 1
  return Math.max(1, Math.min(10, Math.round(score)))
}

// Positive subreddits
export const POSITIVE_REDDIT_SUBS = [
  'UpliftingNews', 'GoodNews', 'MadeMeSmile', 'HumansBeingBros', 'aww',
  'Eyebleach', 'ArtPorn', 'Museum', 'ExposurePorn', 'ITAP', 'perfectloops', 'DesignPorn'
]

// Dev.to tags
export const POSITIVE_DEVTO_TAGS = [
  'productivity', 'career', 'motivation', 'opensource', 'javascript', 'python', 'webdev'
]

// RSS feeds
export const POSITIVE_RSS_FEEDS = [
  { name: 'Good News Network', url: 'https://www.goodnewsnetwork.org/feed/', category: 'general' },
  { name: 'Positive News', url: 'https://www.positive.news/feed/', category: 'general' },
  { name: 'Upworthy', url: 'https://www.upworthy.com/rss', category: 'inspiration' },
  { name: 'BBC Good News', url: 'https://feeds.bbci.co.uk/news/happy/feed.xml', category: 'general' },
  { name: 'Reasons to be Cheerful', url: 'https://reasonstobecheerful.world/feed/', category: 'general' },
  { name: 'Optimist Daily', url: 'https://optimistdaily.com/feed/', category: 'inspiration' },
  { name: 'World Good News', url: 'https://www.goodnewsarea.com/feed/', category: 'general' },
  { name: 'Good News from Ireland', url: 'https://www.goodnewsireland.com/feed/', category: 'community' },
  { name: 'Upbeat News', url: 'https://upbeatnews.com/feed/', category: 'general' },
  { name: 'Nonstop Zen', url: 'https://nonstopzen.com/feed/', category: 'inspiration' },
  { name: 'Goalcast', url: 'https://www.goalcast.com/feed/', category: 'inspiration' },
  { name: 'Science Daily Good', url: 'https://www.sciencedaily.com/rss/all.xml', category: 'science' },
  { name: 'Mindbodygreen', url: 'https://www.mindbodygreen.com/rss', category: 'health' },
  { name: 'Tiny Buddha', url: 'https://tinybuddha.com/feed/', category: 'inspiration' },
  { name: 'Art Limited', url: 'https://www.artlimited.net/rss/photo.xml', category: 'art' },
  { name: '500px Popular', url: 'https://500px.com/popular.rss', category: 'photography' },
  // Kenyan / East African sources
  { name: 'Tuko Good News', url: 'https://www.tuko.co.ke/feeds/good-news.rss', category: 'community' },
  { name: 'Nation Africa', url: 'https://nation.africa/rss', category: 'general' },
]

const HACKER_NEWS_URL = 'https://hacker-news.firebaseio.com/v0/'
const MASTODON_INSTANCES = [
  { instance: 'mastodon.social', tag: 'goodnews' },
  { instance: 'mastodon.social', tag: 'uplift' },
  { instance: 'mastodon.social', tag: 'photography' },
  { instance: 'mastodon.social', tag: 'nature' },
  { instance: 'mastodon.social', tag: 'animals' }
]

// X/Twitter positive accounts to fetch from
const X_POSITIVE_ACCOUNTS = [
  'GoodNews_Movement',
  'Positivify',
  'TheHappyBroadcast',
  'goodnewsnetwork',
  'upworthy',
  'goodnewsnetwork'
]

export function categorizeFromTitle(title: string): string {
  const lower = title.toLowerCase()
  if (/science|research|study|discovery|breakthrough|experiment|lab|physics|chemistry|biology|mars|space/.test(lower)) return 'science'
  if (/health|medical|doctor|hospital|cure|therapy|mental health|wellness|exercise|nutrition|diet/.test(lower)) return 'health'
  if (/animal|dog|cat|puppy|kitten|rescue|pet|wildlife|species|endangered|marine|whale|elephant/.test(lower)) return 'animals'
  if (/community|volunteer|helping|neighbor|donation|charity|fund|raise|support|local|neighborhood/.test(lower)) return 'community'
  if (/environment|climate|solar|wind|renewable|carbon|pollution|ocean|forest|conservation|ecosystem|green/.test(lower)) return 'environment'
  if (/culture|art|music|film|theater|dance|museum|heritage|tradition|festival|literary|book/.test(lower)) return 'culture'
  if (/tech|software|code|\bai\b|robot|app|startup|data|digital|cyber|programmer/.test(lower)) return 'tech'
  if (/kenya|nairobi|mombasa|east africa|tanzania|uganda|swahili|african/.test(lower)) return 'community'
  return 'inspiration'
}

export function extractImageFromContent(content: string, fallbackUrl?: string): string | undefined {
  const imgMatch = content.match(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/i)
  if (imgMatch && isValidHttpUrl(imgMatch[1])) return imgMatch[1]
  const urlMatch = content.match(/(https?:\/\/[^\s"]+\.(?:jpg|jpeg|png|gif|webp))/i)
  if (urlMatch && isValidHttpUrl(urlMatch[1])) return urlMatch[1]
  return fallbackUrl
}

export function extractRedditImage(postData: any): string | undefined {
  if (postData.preview?.images?.[0]?.source?.url) {
    return postData.preview.images[0].source.url.replace(/&amp;/g, '&')
  }
  const resolutions = postData.preview?.images?.[0]?.resolutions || []
  if (resolutions.length > 0) {
    const largest = resolutions[resolutions.length - 1]
    if (largest?.url) return largest.url.replace(/&amp;/g, '&')
  }
  if (postData.url_overridden_by_dest && isValidHttpUrl(postData.url_overridden_by_dest)) {
    const url = postData.url_overridden_by_dest
    if (/\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(url)) return url
    if (url.includes('imgur.com') && !url.includes('/a/')) {
      const imgurId = url.match(/imgur\.com\/(\w+)/)?.[1]
      if (imgurId) return `https://i.imgur.com/${imgurId}.jpg`
    }
  }
  if (postData.thumbnail?.startsWith('http') && postData.thumbnail !== 'nsfw' && postData.thumbnail !== 'self') {
    return postData.thumbnail
  }
  return undefined
}

class XMLParser {
  private xmlText: string
  constructor(xmlText: string) { this.xmlText = xmlText }
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
  getText(): string { return this.xmlText }
}

class Element {
  private xml: string
  private tagName: string
  private parser: XMLParser
  constructor(xml: string, tagName: string, parser: XMLParser) {
    this.xml = xml; this.tagName = tagName; this.parser = parser
  }
  getElementsByTagName(name: string): Element[] {
    const elements: Element[] = []
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
    const endTag = `</${this.tagName}>`
    const contentStart = this.xml.indexOf('>') + 1
    const contentEnd = this.xml.lastIndexOf(endTag)
    if (contentStart >= contentEnd) return ''
    let content = this.xml.substring(contentStart, contentEnd)
    if (content.includes('<![CDATA[')) {
      const cdataStart = content.indexOf('<![CDATA[') + 9
      const cdataEnd = content.indexOf(']]>', cdataStart)
      if (cdataEnd !== -1) content = content.substring(cdataStart, cdataEnd)
    }
    return content.trim()
  }
}

export function parseRSSItems(xmlText: string): any[] {
  const items: any[] = []
  try {
    const parser = new XMLParser(xmlText)
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
  }
  return items
}

export async function fetchRedditPosts(subreddit: string): Promise<FeedItem[]> {
  if (!isValidSubreddit(subreddit)) return []
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 6000)
    const response = await fetch(`https://www.reddit.com/r/${subreddit}/hot.json?limit=10`, {
      headers: { 'User-Agent': 'Uplift/1.0' },
      signal: controller.signal
    })
    clearTimeout(timeout)
    if (!response.ok) return []
    const data = await response.json() as any
    const posts = data.data?.children || []
    return posts.map((post: any) => ({
      id: `reddit-${post.data.id}`,
      title: sanitizeHtml(post.data.title, 200) || '',
      content: sanitizeHtml(post.data.selftext, 1500) || '',
      source: 'reddit',
      sourceName: `r/${subreddit}`,
      sourceUrl: `https://reddit.com${post.data.permalink}`,
      author: sanitizeHtml(post.data.author) || 'anonymous',
      publishedAt: new Date(post.data.created_utc * 1000).toISOString(),
      positivityScore: scorePositivity(post.data.title || '', post.data.selftext || ''),
      category: categorizeFromTitle(post.data.title || ''),
      thumbnail: extractRedditImage(post.data),
      sourceIcon: 'https://www.redditstatic.com/desktop2x/img/favicon/apple-icon-57x57.png',
      tags: [subreddit.toLowerCase()]
    }))
  } catch { return [] }
}

export async function fetchRSSFeed(feedUrl: string, feedName: string): Promise<FeedItem[]> {
  if (!isValidHttpUrl(feedUrl)) return []
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const response = await fetch(feedUrl, {
      headers: { 'User-Agent': 'Uplift/1.0' },
      signal: controller.signal
    })
    clearTimeout(timeout)
    if (!response.ok) return []
    const xml = await response.text()
    const items = parseRSSItems(xml)
    return items.slice(0, 8).map((item: any, index: number) => {
      const rawContent = item.content || item.contentSnippet || item.description || item['content:encoded'] || ''
      const cleanTitle = decodeHTMLEntities(sanitizeHtml(item.title, 200) || '')
      const cleanContent = stripBoilerplate(decodeHTMLEntities(sanitizeHtml(rawContent, 1500)))
      const finalContent = cleanContent.length > 50 ? cleanContent : ''
      return {
        id: `rss-${feedName.toLowerCase().replace(/\s/g, '-')}-${index}`,
        title: cleanTitle,
        content: finalContent,
        source: 'rss',
        sourceName: sanitizeHtml(feedName),
        sourceUrl: item.link || '',
        author: sanitizeHtml(item.author || item['dc:creator'] || feedName),
        publishedAt: item.pubDate || new Date().toISOString(),
        positivityScore: scorePositivity(item.title || '', rawContent),
        category: categorizeFromTitle(cleanTitle),
        thumbnail: item.thumbnail || extractImageFromContent(rawContent),
        sourceIcon: `https://www.google.com/s2/favicons?domain=${new URL(feedUrl).hostname}&sz=64`,
        tags: []
      }
    })
  } catch { return [] }
}

export async function fetchDevToArticles(tag: string): Promise<FeedItem[]> {
  if (!/^[a-zA-Z0-9_-]{1,30}$/.test(tag)) return []
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const response = await fetch(`https://dev.to/api/articles?tag=${encodeURIComponent(tag)}&per_page=4&top=7`, {
      headers: { 'User-Agent': 'Uplift/1.0' },
      signal: controller.signal
    })
    clearTimeout(timeout)
    if (!response.ok) return []
    const articles = await response.json() as any[]
    return articles.slice(0, 5).map((article: any) => ({
      id: `devto-${article.id}`,
      title: sanitizeHtml(article.title, 200) || '',
      content: sanitizeHtml(article.description || article.body_markdown, 1500) || '',
      source: 'devto',
      sourceName: 'Dev.to',
      sourceUrl: article.url,
      author: sanitizeHtml(article.user?.name) || 'anonymous',
      publishedAt: article.published_at,
      positivityScore: scorePositivity(article.title || '', article.description || ''),
      category: 'tech',
      tags: article.tag_list || [],
      thumbnail: article.cover_image || undefined,
      sourceIcon: 'https://dev-to-uploads.s3.amazonaws.com/uploads/logos/original_logo_0D1117.png'
    }))
  } catch { return [] }
}

export async function fetchMastodonPosts(instance: string, tag: string): Promise<FeedItem[]> {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]$/.test(instance) || !/^[a-zA-Z0-9_]{1,40}$/.test(tag)) return []
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
  } catch { return [] }
}

export async function fetchHackerNewsShow(): Promise<FeedItem[]> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    const response = await fetch(`${HACKER_NEWS_URL}topstories.json`, { signal: controller.signal })
    clearTimeout(timeout)
    if (!response.ok) return []
    const storyIds = (await response.json()) as number[]
    const topIds = storyIds.slice(0, 30)
    const stories = await Promise.all(topIds.map(async (id) => {
      try {
        const storyRes = await fetch(`${HACKER_NEWS_URL}item/${id}.json`, { signal: controller.signal })
        if (!storyRes.ok) return null
        return await storyRes.json()
      } catch { return null }
    }))
    const validStories = stories.filter((s: any) => s && s.title && s.title.toLowerCase().includes('show hn'))
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
  } catch { return [] }
}

export async function fetchYouTubeRSS(channelId: string, channelName: string): Promise<FeedItem[]> {
  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const response = await fetch(feedUrl, { headers: { 'User-Agent': 'Uplift/1.0' }, signal: controller.signal })
    clearTimeout(timeout)
    if (!response.ok) return []
    const xml = await response.text()
    const entries: any[] = []
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g
    let match
    while ((match = entryRegex.exec(xml)) !== null && entries.length < 10) {
      const entryXml = match[1]
      const videoIdMatch = entryXml.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)
      const videoId = videoIdMatch ? videoIdMatch[1] : ''
      const titleMatch = entryXml.match(/<title>([^<]*)<\/title>/)
      const title = titleMatch ? titleMatch[1] : ''
      const publishedMatch = entryXml.match(/<published>([^<]+)<\/published>/)
      const published = publishedMatch ? publishedMatch[1] : new Date().toISOString()
      const thumbMatch = entryXml.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/)
      const thumbnail = thumbMatch ? thumbMatch[1] : `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
      if (videoId && title) {
        entries.push({
          id: `youtube-${videoId}`,
          title: sanitizeHtml(title),
          content: `Video from ${channelName}`,
          source: 'youtube',
          sourceName: channelName,
          sourceUrl: `https://youtube.com/watch?v=${videoId}`,
          author: channelName,
          publishedAt: published,
          positivityScore: 7,
          category: categorizeFromTitle(title),
          thumbnail,
          sourceIcon: 'https://www.youtube.com/favicon.ico',
          tags: ['youtube', 'video']
        })
      }
    }
    return entries
  } catch { return [] }
}

export async function fetchXTwitterPosts(username: string, bearerToken?: string): Promise<FeedItem[]> {
  if (!bearerToken) {
    // Fallback to RSS if no API token
    try {
      const rssUrl = `https://nitter.net/${username}/rss`
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      const response = await fetch(rssUrl, { headers: { 'User-Agent': 'Uplift/1.0' }, signal: controller.signal })
      clearTimeout(timeout)
      if (!response.ok) return []
      const xml = await response.text()
      const items = parseRSSItems(xml)
      return items.slice(0, 5).map((item: any, index: number) => ({
        id: `x-${username}-${index}`,
        title: sanitizeHtml(item.title, 200) || '',
        content: sanitizeHtml(item.content || item.description, 500) || '',
        source: 'x',
        sourceName: `@${username}`,
        sourceUrl: item.link || '',
        author: username,
        publishedAt: item.pubDate || new Date().toISOString(),
        positivityScore: 8,
        category: categorizeFromTitle(item.title || ''),
        thumbnail: undefined,
        sourceIcon: 'https://abs.twimg.com/favicons/twitter.ico',
        tags: ['twitter', 'x']
      }))
    } catch { return [] }
  }

  // Use X API v2 with bearer token
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const response = await fetch(`https://api.twitter.com/2/users/by/username/${username}?user.fields=public_metrics`, {
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'User-Agent': 'Uplift/1.0'
      },
      signal: controller.signal
    })
    clearTimeout(timeout)
    if (!response.ok) return []
    const userData = await response.json() as any
    const userId = userData.data?.id
    if (!userId) return []

    const tweetsResponse = await fetch(`https://api.twitter.com/2/users/${userId}/tweets?max_results=10&tweet.fields=created_at,public_metrics,entities`, {
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'User-Agent': 'Uplift/1.0'
      }
    })
    if (!tweetsResponse.ok) return []
    const tweetsData = await tweetsResponse.json() as any
    const tweets = tweetsData.data || []

    return tweets.map((tweet: any) => ({
      id: `x-${tweet.id}`,
      title: sanitizeHtml(tweet.text?.substring(0, 200) || '', 200),
      content: sanitizeHtml(tweet.text || '', 500),
      source: 'x',
      sourceName: `@${username}`,
      sourceUrl: `https://x.com/${username}/status/${tweet.id}`,
      author: username,
      publishedAt: tweet.created_at || new Date().toISOString(),
      positivityScore: 8,
      category: categorizeFromTitle(tweet.text || ''),
      thumbnail: tweet.entities?.media?.[0]?.url || undefined,
      sourceIcon: 'https://abs.twimg.com/favicons/twitter.ico',
      tags: ['twitter', 'x']
    }))
  } catch { return [] }
}

export async function fetchAllSources(env: Env): Promise<FeedItem[]> {
  const results = await Promise.allSettled([
    ...POSITIVE_REDDIT_SUBS.map(sub => fetchRedditPosts(sub)),
    ...POSITIVE_RSS_FEEDS.slice(0, 10).map(feed => fetchRSSFeed(feed.url, feed.name)),
    ...POSITIVE_DEVTO_TAGS.map(tag => fetchDevToArticles(tag)),
    // Optionally fetch HN + Mastodon if we want more sources
    ...MASTODON_INSTANCES.slice(0, 2).map(m => fetchMastodonPosts(m.instance, m.tag)),
    fetchHackerNewsShow(),
    // X/Twitter feeds with fallback to RSS
    ...X_POSITIVE_ACCOUNTS.slice(0, 3).map(account => fetchXTwitterPosts(account, env.X_BEARER_TOKEN))
  ])

  const allPosts: FeedItem[] = []
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allPosts.push(...result.value)
    }
  }
  return allPosts
}
