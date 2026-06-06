// Core feed item type
export interface Creator {
  id: number
  x_handle: string
  name: string
  bio: string
  avatar_url?: string
  categories: string[]
  is_verified: boolean
  reciprocity_score: number
}

export interface FeedItem {
    id: string
    title: string
    content: string
    source: 'reddit' | 'rss' | 'mastodon' | 'devto'
    sourceName: string
    sourceUrl: string
    author: string
    publishedAt: string
    positivityScore: number // 1-10
    classification?: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE'
    thumbnail?: string
    sourceIcon?: string
    tags: string[]
    category: string
}

export interface CirclePost {
  id: string
  creator: Creator
  content: string
  media_urls: string[]
  posted_at: string
  positivity_score: number
  engagement: number
  amplified_by: string[]
}

export interface UserPreferences {
    positivityFilter: number // 0-100
    selectedCategories: string[]
    bookmarkedIds: string[]
    theme: 'light' | 'dark' | 'system'
}

export type Category = {
    id: string
    label: string
    icon: string // emoji
    color: string
}

export const CATEGORIES: Category[] = [
    { id: 'science', label: 'Science', icon: '', color: '#6366f1' },
    { id: 'community', label: 'Community', icon: '', color: '#f59e0b' },
    { id: 'health', label: 'Health', icon: '', color: '#22c55e' },
    { id: 'inspiration', label: 'Inspiration', icon: '', color: '#f97316' },
    { id: 'animals', label: 'Animals', icon: '', color: '#ec4899' },
    { id: 'tech', label: 'Tech', icon: '', color: '#0ea5e9' },
]

export const DEFAULT_PREFS: UserPreferences = {
    positivityFilter: 70,
    selectedCategories: [],
    bookmarkedIds: [],
    theme: 'system',
}
