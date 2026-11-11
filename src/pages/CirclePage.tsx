import { useState, useEffect } from 'react'
import { Users, TrendingUp, Search, UserPlus, Sparkles, Loader2, AlertTriangle } from 'lucide-react'
import { Creator, CirclePost } from '../types'
import { fetchCircleDirectory, fetchCircleFeed, fetchLeaderboard } from '../services/circleApi'
import CreatorCard from '../components/CreatorCard'
import CirclePostCard from '../components/CirclePostCard'
import LeaderboardCard from '../components/LeaderboardCard'
import JoinCircleModal from '../components/JoinCircleModal'

export default function CirclePage() {
  const [activeTab, setActiveTab] = useState<'feed' | 'directory' | 'leaderboard'>('feed')
  const [creators, setCreators] = useState<Creator[]>([])
  const [posts, setPosts] = useState<CirclePost[]>([])
  const [leaderboard, setLeaderboard] = useState<Creator[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false)
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    async function loadData() {
      setIsLoading(true)
      setError(null)
      try {
        if (activeTab === 'directory') {
          const data = await fetchCircleDirectory()
          setCreators(data)
        } else if (activeTab === 'feed') {
          const data = await fetchCircleFeed()
          setPosts(data)
        } else if (activeTab === 'leaderboard') {
          const data = await fetchLeaderboard()
          setLeaderboard(data)
        }
      } catch (err: any) {
        console.error('Failed to load circle data:', err)
        setError(err?.message || 'Failed to load data. Please try again.')
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [activeTab, reloadTick])

  const filteredCreators = creators.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.x_handle.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div>
      {/* Compact X-Style Header */}
      <div className="x-feed-header pb-0 sticky top-[56px] lg:top-0 z-40 bg-[var(--bg)]/90 backdrop-blur" style={{ flexDirection: 'column', gap: 0, padding: 0 }}>
        <div className="px-4 py-3 flex items-center justify-between w-full">
          <div className="x-feed-title">
            <h1 className="text-xl">Creators Circle</h1>
            <p className="x-feed-intro">
              <Sparkles size={10} />
              Amplify positive voices from East Africa
            </p>
          </div>
          <button 
            onClick={() => setIsJoinModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black dark:bg-white text-white dark:text-black font-bold text-sm hover:opacity-90 transition-opacity"
          >
            <UserPlus size={16} />
            <span className="hidden sm:inline">Join</span>
          </button>
        </div>

        {/* X-Style Tabs */}
        <div className="flex w-full border-b border-[var(--border)] mt-1">
          {[
            { id: 'feed', label: 'Feed' },
            { id: 'directory', label: 'Directory' },
            { id: 'leaderboard', label: 'Leaderboard' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className="flex-1 flex justify-center py-3 px-2 text-sm font-bold transition-colors hover:bg-[var(--bg-muted)] relative whitespace-nowrap"
              style={{ color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)' }}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 rounded-t-full bg-azure" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full max-w-[600px] mx-auto border-x border-[var(--border)] min-h-screen">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={24} className="spin text-azure" />
          </div>
        ) : error ? (
          <div className="x-empty">
            <AlertTriangle size={40} className="text-[var(--text-muted)]" />
            <p>Something went wrong</p>
            <p>{error}</p>
            <button onClick={() => setReloadTick(t => t + 1)} className="btn btn-primary" style={{ padding: '10px 20px', fontSize: '14px', marginTop: 8 }}>
              Retry
            </button>
          </div>
        ) : (
          <>
            {activeTab === 'feed' && (
              <div>
                {posts.length === 0 ? (
                  <div className="x-empty">
                    <Users size={40} className="text-[var(--border)]" />
                    <p>No positive posts yet</p>
                    <p>Wait for the next sync or join the circle to post.</p>
                  </div>
                ) : (
                  posts.map((post, i) => (
                    <CirclePostCard key={post.id} post={post} index={i} userHandle="uplifter" />
                  ))
                )}
              </div>
            )}

            {activeTab === 'directory' && (
              <div>
                <div className="p-3 border-b border-[var(--border)]">
                  <div className="relative">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                    <input 
                      type="text" 
                      placeholder="Search creators..." 
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full bg-[var(--bg-muted)] border-none rounded-full py-2.5 pl-11 pr-4 text-[var(--text-primary)] text-sm focus:outline-none focus:ring-1 focus:ring-azure transition-colors"
                    />
                  </div>
                </div>
                
                {filteredCreators.length === 0 ? (
                  <div className="x-empty">
                    <Search size={40} className="text-[var(--border)]" />
                    <p>No creators found</p>
                  </div>
                ) : (
                  <div>
                    {filteredCreators.map(creator => (
                      <CreatorCard key={creator.id} creator={creator} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'leaderboard' && (
              <div>
                <div className="p-4 border-b border-[var(--border)] bg-[var(--bg-muted)] text-[13px] text-[var(--text-secondary)]">
                  Earn points by amplifying other creators' positive posts, and when your positive posts are amplified. Mutual sharing wins!
                </div>
                
                {leaderboard.length === 0 ? (
                  <div className="x-empty">
                    <TrendingUp size={40} className="text-[var(--border)]" />
                    <p>Leaderboard is empty</p>
                  </div>
                ) : (
                  leaderboard.map((creator, i) => (
                    <LeaderboardCard key={creator.id} creator={creator} rank={i + 1} />
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>

      <JoinCircleModal isOpen={isJoinModalOpen} onClose={() => setIsJoinModalOpen(false)} />
    </div>
  )
}
