import type { KVNamespace, D1Database } from '@cloudflare/workers-types'

// Core feed item type
export interface FeedItem {
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

// Circle types
export interface Creator {
  id: number
  x_handle: string
  x_user_id?: string
  name: string
  bio: string
  avatar_url?: string
  categories: string[]
  is_verified: boolean
  reciprocity_score: number
  joined_at: string
  last_active: string
}

export interface CirclePost {
  id: string
  creator_id: number
  content: string
  media_urls: string[]
  posted_at: string
  positivity_score: number
  engagement: number
  amplified_by: string[]
  processed_at: string
  // Joined fields
  creator?: Creator
}

// Environment bindings
export interface Env {
  GROQ_API_KEY: string
  X_BEARER_TOKEN?: string
  X_CLIENT_ID?: string
  X_CLIENT_SECRET?: string
  X_CREATORS_LIST_ID?: string
  TG_BOT_TOKEN?: string
  UPLIFT_CACHE: KVNamespace
  ASSETS?: Fetcher
  DB?: D1Database
  SESSION_SECRET?: string
  VAPID_PUBLIC_KEY?: string
  VAPID_PRIVATE_KEY?: string
}
