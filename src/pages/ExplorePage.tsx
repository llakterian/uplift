import { useState, useEffect } from 'react'
import { Search, TrendingUp, Loader2 } from 'lucide-react'
import { FeedItem } from '../types'
import { fetchFeed, Language } from '../services/api'

interface ExplorePageProps {
  lang: Language
}

export default function ExplorePage({ lang }: ExplorePageProps) {
  const [query, setQuery] = useState('')
  const [trending, setTrending] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const data = await fetchFeed(lang)
        // Show highest positivity items as "trending"
        const sorted = [...data].sort((a, b) => b.positivityScore - a.positivityScore)
        setTrending(sorted.slice(0, 10))
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [lang])

  return (
    <div>
      {/* X-style Explore Header */}
      <div className="x-feed-header">
        <div className="x-feed-title">
          <h1>Explore</h1>
        </div>
      </div>

      {/* Search bar */}
      <div className="p-3 border-b border-[var(--border)]">
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search Uplift"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full bg-[var(--bg-muted)] border-none rounded-full py-2.5 pl-11 pr-4 text-[var(--text-primary)] text-[15px] focus:outline-none focus:ring-1 focus:ring-[var(--brand-x)] transition-colors"
          />
        </div>
      </div>

      {/* Trending topics */}
      <div className="border-b border-[var(--border)]">
        <h2 className="font-bold text-xl px-4 pt-3 pb-1" style={{ letterSpacing: '-0.02em' }}>
          {lang === 'sw' ? 'Inauma Moto' : 'Trending'}
        </h2>
        <p className="px-4 pb-3 text-[13px] text-[var(--text-muted)]">
          {lang === 'sw' ? 'Hadithi zenye nguvu zaidi' : 'The most uplifting stories right now'}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={24} className="spin text-[var(--brand-x)]" />
        </div>
      ) : (
        <>
          {/* Trending items as X-style cards */}
          {trending.map((item, idx) => {
            const rank = idx + 1
            return (
              <div key={item.id} className="x-card flex items-start gap-3">
                <div className="w-8 text-center flex-shrink-0 pt-2">
                  <span className={`font-black text-lg ${rank <= 3 ? 'text-[var(--brand-x)]' : 'text-[var(--text-muted)]'}`}>
                    {rank}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 mb-0.5">
                    <TrendingUp size={14} className="text-[var(--brand-x)]" />
                    <span className="text-[13px] text-[var(--text-muted)]">Trending in Uplift</span>
                  </div>
                  <h3 className="font-bold text-[15px] mb-0.5">
                    {item.content.length > 80 ? item.content.substring(0, 80) + '...' : item.content}
                  </h3>
                  <span className="text-[13px] text-[var(--text-muted)]">
                    {item.sourceName} · {item.positivityScore * 10}% positivity
                  </span>
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}