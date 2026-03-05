const API_BASE = '/api'

export async function fetchFeed() {
  try {
    const response = await fetch(`${API_BASE}/feed`)
    if (!response.ok) throw new Error('Failed to fetch')
    const data = await response.json()
    return data.posts || []
  } catch (error) {
    console.error('API Error:', error)
    return getMockFeed()
  }
}

export async function fetchCategories() {
  try {
    const response = await fetch(`${API_BASE}/categories`)
    if (!response.ok) throw new Error('Failed to fetch')
    return await response.json()
  } catch (error) {
    console.error('API Error:', error)
    return { categories: DEFAULT_CATEGORIES }
  }
}

const DEFAULT_CATEGORIES = [
  { id: 'science', label: 'Science' },
  { id: 'health', label: 'Health' },
  { id: 'animals', label: 'Animals' },
  { id: 'community', label: 'Community' },
  { id: 'inspiration', label: 'Inspiration' }
]

function getMockFeed() {
  return [
    {
      id: '1',
      title: 'Scientists Discover New Species of Orchid in Amazon Rainforest',
      content: 'A team of researchers has discovered a beautiful new species of orchid in the depths of the Amazon rainforest...',
      source: 'r/UpliftingNews',
      sourceUrl: 'https://reddit.com',
      author: 'NatureLover',
      publishedAt: '2026-03-05T10:00:00Z',
      positivityScore: 9,
      category: 'science',
      tags: ['science', 'nature']
    },
    {
      id: '2',
      title: 'Community Comes Together to Rebuild Local Park After Storm',
      content: 'Over 500 volunteers gathered this weekend to help rebuild the beloved central park...',
      source: 'r/GoodNews',
      sourceUrl: 'https://reddit.com',
      author: 'CommunityHero',
      publishedAt: '2026-03-05T09:30:00Z',
      positivityScore: 10,
      category: 'community',
      tags: ['community', 'inspiration']
    },
    {
      id: '3',
      title: 'New Cancer Treatment Shows 90% Success Rate in Trials',
      content: 'Medical researchers announce breakthrough in cancer treatment that has shown remarkable results...',
      source: 'r/science',
      sourceUrl: 'https://reddit.com',
      author: 'ScienceDaily',
      publishedAt: '2026-03-05T08:00:00Z',
      positivityScore: 9,
      category: 'health',
      tags: ['science', 'health']
    },
    {
      id: '4',
      title: 'Golden Retriever Saves Family From House Fire',
      content: 'A heroic dog alerted his family to a fire in the middle of the night, saving five lives...',
      source: 'r/aww',
      sourceUrl: 'https://reddit.com',
      author: 'DogLover123',
      publishedAt: '2026-03-05T07:00:00Z',
      positivityScore: 10,
      category: 'animals',
      tags: ['animals', 'hero']
    },
    {
      id: '5',
      title: 'Students Raise $50,000 for Classmate Medical Treatment',
      content: 'A fundraising campaign organized by students raised over $50,000 to help their classmate...',
      source: 'r/HumansBeingBros',
      sourceUrl: 'https://reddit.com',
      author: 'KindnessMatters',
      publishedAt: '2026-03-05T06:00:00Z',
      positivityScore: 10,
      category: 'community',
      tags: ['community', 'inspiration']
    }
  ]
}
