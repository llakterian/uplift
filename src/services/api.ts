import { FeedItem } from '../types'
import { authHeaders, isLoggedIn } from './auth'

const API_BASE = '/api'

// Helper: build a FeedItem from a Reddit post for client-side fallback
function redditToFeedItem(post: any, subreddit: string): FeedItem {
  return {
    id: `reddit-${post.data.id}`,
    title: post.data.title,
    content: post.data.selftext || '',
    source: 'reddit',
    sourceName: `r/${subreddit}`,
    sourceUrl: `https://reddit.com${post.data.permalink}`,
    author: post.data.author || 'anonymous',
    publishedAt: new Date(post.data.created_utc * 1000).toISOString(),
    positivityScore: 8, // Subreddit verified positive baseline
    thumbnail: post.data.thumbnail?.startsWith('http') ? post.data.thumbnail : undefined,
    sourceIcon: 'https://www.redditstatic.com/desktop2x/img/favicon/apple-icon-57x57.png',
    category: categorize(post.data.title || ''),
    tags: [subreddit.toLowerCase()],
  }
}

function categorize(title: string): string {
  const t = title.toLowerCase()
  if (/science|research|study|discovery|breakthrough|experiment|lab|physics|chemistry|biology|mars|space/.test(t)) return 'science'
  if (/health|medical|doctor|hospital|cure|therapy|mental health|wellness|exercise|nutrition|diet/.test(t)) return 'health'
  if (/animal|dog|cat|puppy|kitten|rescue|pet|wildlife|species|endangered|marine|whale|elephant/.test(t)) return 'animals'
  if (/community|volunteer|helping|neighbor|donation|charity|fund|raise|support|local|neighborhood/.test(t)) return 'community'
  if (/environment|climate|solar|wind|renewable|carbon|pollution|ocean|forest|conservation|ecosystem|green/.test(t)) return 'environment'
  if (/culture|art|music|film|theater|dance|museum|heritage|tradition|festival|literary|book/.test(t)) return 'culture'
  if (/tech|\bai\b|app|software|robot|code/.test(t)) return 'tech'
  if (/kenya|nairobi|mombasa|east africa|tanzania|uganda|swahili|african/.test(t)) return 'community'
  return 'inspiration'
}

function getSourceIcon(source: string, url: string, existing?: string): string {
  if (existing) return existing
  if (source === 'reddit') return 'https://www.redditstatic.com/desktop2x/img/favicon/apple-icon-57x57.png'
  if (source === 'devto') return 'https://dev-to-uploads.s3.amazonaws.com/uploads/logos/original_logo_0D1117.png'
  // RSS fallback
  try {
    const host = new URL(url).hostname
    return `https://www.google.com/s2/favicons?domain=${host}&sz=64`
  } catch {
    return ''
  }
}

export type Language = 'en' | 'sw'

export async function fetchDailyDigest(lang: Language = 'en'): Promise<{ intro?: string; posts: FeedItem[] }> {
  try {
    const res = await fetch(`${API_BASE}/feed/daily-digest?lang=${lang}&stream=false`, {
      headers: { Accept: 'application/json' },
    })
    if (res.ok) {
      const data = await res.json()
      return {
        intro: data.intro,
        posts: (data.posts || data).map((item: any): FeedItem => ({
          id: item.id,
          title: item.title || '',
          content: item.content || item.selftext || '',
          source: (item.source || 'rss') as FeedItem['source'],
          sourceName: item.sourceName || item.source || 'Unknown',
          sourceUrl: item.sourceUrl || item.url || '#',
          author: item.author || 'Unknown',
          publishedAt: item.publishedAt || new Date().toISOString(),
          positivityScore: item.positivityScore ?? 7,
          classification: item.classification,
          thumbnail: item.thumbnail,
          sourceIcon: getSourceIcon(item.source || 'rss', item.sourceUrl || item.url || '', item.sourceIcon),
          tags: item.tags ?? [item.category ?? 'inspiration'],
          category: item.category ?? 'inspiration',
        })),
      }
    }
  } catch {
    console.warn('Daily digest unavailable, using fallback')
  }
  return { posts: [], intro: undefined }
}

export async function fetchAIDeepDive(title: string, reason: string, lang: Language = 'en'): Promise<string> {
  try {
    const res = await fetch(`${API_BASE}/feed/why-this`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, reason, lang }),
    })
    if (res.ok) {
      const data = await res.json()
      return data.explanation || data.response || ''
    }
  } catch {
    console.warn('AI deep dive unavailable')
  }
  return ''
}

// Try the Worker API first, fallback to direct Reddit JSON
export async function fetchFeed(lang?: Language): Promise<FeedItem[]> {
  try {
    const url = lang ? `${API_BASE}/feed?lang=${lang}` : `${API_BASE}/feed`
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    })
    if (res.ok) {
      const data = await res.json() as any
      const posts = data.posts || data
      if (posts && posts.length > 0) {
        const mapped = posts.map((item: any): FeedItem => ({
          id: item.id,
          title: item.title || '',
          content: item.content || item.selftext || '',
          source: (item.source || 'rss') as FeedItem['source'],
          sourceName: item.sourceName || item.source || 'Unknown',
          sourceUrl: item.sourceUrl || item.url || '#',
          author: item.author || 'Unknown',
          publishedAt: item.publishedAt || new Date().toISOString(),
          positivityScore: item.positivityScore ?? 7,
          classification: item.classification,
          thumbnail: item.thumbnail,
          sourceIcon: getSourceIcon(item.source || 'rss', item.sourceUrl || item.url || '', item.sourceIcon),
          tags: item.tags ?? [item.category ?? 'inspiration'],
          category: item.category ?? 'inspiration',
        }))
        // Client-side dedup safety net (by id and normalized title)
        const seenIds = new Set<string>()
        const seenTitles = new Set<string>()
        const norm = (t: string) => (t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 80)
        return mapped.filter((p: FeedItem) => {
          if (seenIds.has(p.id)) return false
          const nt = norm(p.title)
          if (nt && seenTitles.has(nt)) return false
          seenIds.add(p.id)
          if (nt) seenTitles.add(nt)
          return true
        })
      }
    }
  } catch {
    // fall through to direct Reddit
  }

  // Direct Reddit JSON fallback (works without a running Worker)
  return fetchDirectReddit()
}

async function fetchDirectReddit(): Promise<FeedItem[]> {
  const SUBS = ['UpliftingNews', 'GoodNews', 'HumansBeingBros', 'MadeMeSmile', 'aww']
  const results = await Promise.allSettled(
    SUBS.map(sub =>
      fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=12`, {
        headers: { 'User-Agent': 'Uplift/1.0 (web app)' },
      }).then(r => r.json())
    )
  )

  const items: FeedItem[] = []
  results.forEach((result, idx) => {
    if (result.status === 'fulfilled') {
      const posts = result.value?.data?.children ?? []
      posts.forEach((p: any) => items.push(redditToFeedItem(p, SUBS[idx])))
    }
  })

  // Shuffle for variety
  return items.sort(() => Math.random() - 0.4)
}

export async function fetchBookmarkedItems(ids: string[]): Promise<FeedItem[]> {
  // Bookmarks are stored as full items in localStorage, not re-fetched
  const stored = localStorage.getItem('uplift_bookmark_data')
  if (!stored) return []
  const map = JSON.parse(stored) as Record<string, FeedItem>
  return ids.map(id => map[id]).filter(Boolean)
}

export function saveBookmarkData(id: string, item: FeedItem) {
  const stored = localStorage.getItem('uplift_bookmark_data')
  const map = stored ? JSON.parse(stored) as Record<string, FeedItem> : {}
  map[id] = item
  localStorage.setItem('uplift_bookmark_data', JSON.stringify(map))
}

export function removeBookmarkData(id: string) {
  const stored = localStorage.getItem('uplift_bookmark_data')
  if (!stored) return
  const map = JSON.parse(stored) as Record<string, FeedItem>
  delete map[id]
  localStorage.setItem('uplift_bookmark_data', JSON.stringify(map))
}

/**
 * Get the full stored payload for a bookmarked item.
 * Used when syncing a bookmark to the server, which needs title/url/image.
 */
export function getBookmarkPayload(id: string): FeedItem | null {
  try {
    const stored = localStorage.getItem('uplift_bookmark_data')
    if (!stored) return null
    const map = JSON.parse(stored) as Record<string, FeedItem>
    return map[id] || null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Server-backed bookmarks (requires an authenticated session)
// ---------------------------------------------------------------------------

/**
 * Fetch the bookmark ids stored server-side for the signed-in user.
 * Returns null when the user is not authenticated or the request fails.
 */
export async function fetchServerBookmarkIds(): Promise<string[] | null> {
  if (!isLoggedIn()) return null
  try {
    const res = await fetch('/api/bookmarks', { headers: authHeaders() })
    if (!res.ok) return null
    const data = await res.json()
    if (data?.useLocalStorage) return null
    const bookmarks = Array.isArray(data?.bookmarks) ? data.bookmarks : []
    return bookmarks.map((b: any) => b.post_id).filter(Boolean)
  } catch {
    return null
  }
}

/** Save a bookmark server-side. Returns false when it could not be saved. */
export async function addServerBookmark(item: FeedItem): Promise<boolean> {
  if (!isLoggedIn()) return false
  try {
    const res = await fetch('/api/bookmarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        id: item.id,
        title: item.title,
        url: item.sourceUrl,
        image: item.thumbnail || null,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

/** Remove a bookmark server-side. */
export async function removeServerBookmark(postId: string): Promise<boolean> {
  if (!isLoggedIn()) return false
  try {
    const res = await fetch(`/api/bookmarks/${encodeURIComponent(postId)}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
    return res.ok
  } catch {
    return false
  }
}
