import { useState, useEffect } from 'react'
import { Sun, Moon, Heart, RefreshCw, Sparkles } from 'lucide-react'
import FeedCard from './components/FeedCard'
import PositivitySlider from './components/PositivitySlider'
import CategoryFilter from './components/CategoryFilter'
import { fetchFeed } from './services/api'

interface FeedItem {
  id: string
  title: string
  content: string
  source: string
  sourceUrl: string
  author: string
  publishedAt: string
  positivityScore: number
  thumbnail?: string
  tags: string[]
}

function App() {
  const [darkMode, setDarkMode] = useState(false)
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [positivityFilter, setPositivityFilter] = useState(70)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [bookmarks, setBookmarks] = useState<string[]>([])

  useEffect(() => {
    // Load feed from API
    setLoading(true)
    fetchFeed().then(data => {
      setFeed(data)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  const filteredFeed = feed.filter(item => {
    const passesPositivity = item.positivityScore >= (positivityFilter / 10)
    const passesCategory = selectedCategories.length === 0 || 
      item.tags.some(tag => selectedCategories.includes(tag))
    return passesPositivity && passesCategory
  })

  const toggleBookmark = (id: string) => {
    setBookmarks(prev => 
      prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white dark:bg-slate-800 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-600 rounded-xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Uplift</h1>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            >
              {darkMode ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5 text-gray-600" />}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Positivity Slider */}
        <section className="mb-6">
          <PositivitySlider 
            value={positivityFilter} 
            onChange={setPositivityFilter} 
          />
        </section>

        {/* Category Filter */}
        <section className="mb-6">
          <CategoryFilter 
            selected={selectedCategories}
            onChange={setSelectedCategories}
          />
        </section>

        {/* Stats */}
        <div className="flex items-center justify-between mb-4 text-sm text-gray-600 dark:text-gray-400">
          <span>{filteredFeed.length} positive stories</span>
          <button className="flex items-center gap-1 hover:text-green-600 transition-colors">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Feed */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white dark:bg-slate-800 rounded-xl p-4 animate-shimmer h-40" />
            ))}
          </div>
        ) : filteredFeed.length === 0 ? (
          <div className="text-center py-12">
            <Heart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">No stories match your filters</p>
            <button 
              onClick={() => { setPositivityFilter(70); setSelectedCategories([]); }}
              className="mt-4 text-green-600 hover:underline"
            >
              Reset filters
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredFeed.map(item => (
              <FeedCard 
                key={item.id} 
                item={item} 
                isBookmarked={bookmarks.includes(item.id)}
                onBookmark={() => toggleBookmark(item.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export default App
