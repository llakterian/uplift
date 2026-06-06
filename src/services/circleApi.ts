import { Creator, CirclePost } from '../types'

const API_BASE = '/api/circle'

export async function fetchCircleDirectory(page = 1, limit = 50): Promise<Creator[]> {
  const res = await fetch(`${API_BASE}/directory?page=${page}&limit=${limit}`)
  if (!res.ok) throw new Error('Failed to fetch directory')
  const data = await res.json()
  return data.creators || []
}

export async function fetchCircleFeed(page = 1, limit = 50): Promise<CirclePost[]> {
  const res = await fetch(`${API_BASE}/feed?page=${page}&limit=${limit}`)
  if (!res.ok) throw new Error('Failed to fetch circle feed')
  const data = await res.json()
  return data.posts || []
}

export async function fetchLeaderboard(): Promise<Creator[]> {
  const res = await fetch(`${API_BASE}/leaderboard`)
  if (!res.ok) throw new Error('Failed to fetch leaderboard')
  const data = await res.json()
  return data.leaderboard || []
}

export async function submitJoinRequest(formData: { x_handle: string, name: string, bio: string, categories: string[] }): Promise<void> {
  const res = await fetch(`${API_BASE}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formData)
  })
  if (!res.ok) throw new Error('Failed to submit join request')
}

export async function trackAmplification(post_id: string, amplifier_handle: string): Promise<void> {
  const res = await fetch(`${API_BASE}/amplify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ post_id, amplifier_handle })
  })
  if (!res.ok) throw new Error('Failed to track amplification')
}
