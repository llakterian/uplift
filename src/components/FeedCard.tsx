import { Heart, ExternalLink, Clock } from 'lucide-react'

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

interface FeedCardProps {
  item: FeedItem
  isBookmarked: boolean
  onBookmark: () => void
}

function FeedCard({ item, isBookmarked, onBookmark }: FeedCardProps) {
  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const hours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    if (hours < 1) return 'Just now'
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  const getScoreColor = (score: number) => {
    if (score >= 9) return 'bg-green-500'
    if (score >= 7) return 'bg-green-400'
    if (score >= 5) return 'bg-yellow-400'
    return 'bg-red-400'
  }

  return (
    <article className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow animate-fade-in">
      {/* Score Badge */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium text-white ${getScoreColor(item.positivityScore)}`}>
            {item.positivityScore}/10
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">{item.source}</span>
        </div>
        <button
          onClick={onBookmark}
          className={`p-2 rounded-lg transition-colors ${isBookmarked ? 'text-green-500' : 'text-gray-400 hover:text-green-500'}`}
        >
          <Heart className={`w-5 h-5 ${isBookmarked ? 'fill-current' : ''}`} />
        </button>
      </div>

      {/* Title */}
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2">
        {item.title}
      </h2>

      {/* Content */}
      <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 line-clamp-3">
        {item.content}
      </p>

      {/* Tags */}
      <div className="flex flex-wrap gap-2 mb-4">
        {item.tags.map(tag => (
          <span 
            key={tag} 
            className="px-2 py-1 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 text-xs rounded-full"
          >
            #{tag}
          </span>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-3">
          <span>by {item.author}</span>
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {getTimeAgo(item.publishedAt)}
          </span>
        </div>
        <a 
          href={item.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-green-600 hover:text-green-700 transition-colors"
        >
          Read more
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </article>
  )
}

export default FeedCard
