import { FeedItem } from '../types'

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
  if (/science|research|study|discovery|breakthrough/.test(t)) return 'science'
  if (/health|medical|doctor|hospital|cure/.test(t)) return 'health'
  if (/animal|dog|cat|puppy|kitten|rescue|pet|wildlife/.test(t)) return 'animals'
  if (/community|volunteer|helping|neighbor|donation|charity/.test(t)) return 'community'
  if (/tech|ai|app|software|robot|code/.test(t)) return 'tech'
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

// Try the Worker API first, fallback to direct Reddit JSON
export async function fetchFeed(): Promise<FeedItem[]> {
  try {
    const res = await fetch(`${API_BASE}/feed`, {
      headers: { Accept: 'application/json' },
    })
    if (res.ok) {
      const data = await res.json() as any
      // Normalise: server returns posts array, assign tags from category if missing
      return (data.posts || data).map((item: any): FeedItem => ({
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
