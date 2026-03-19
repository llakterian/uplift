import { motion } from 'framer-motion'
import { Heart, ExternalLink, Clock, Share2, Sparkles } from 'lucide-react'
import { FeedItem } from '../types'
import { saveBookmarkData, removeBookmarkData } from '../services/api'
import { sanitizeHtml } from '../utils/security'

interface FeedCardProps {
  item: FeedItem
  isBookmarked: boolean
  onBookmark: () => void
  onDeepDive?: (item: FeedItem) => void
  onImageClick?: (url: string) => void
  index?: number
  lang?: 'en' | 'sw'
}

function getTimeAgo(dateString: string, lang: 'en' | 'sw' = 'en'): string {
  const ms = Date.now() - new Date(dateString).getTime()
  const mins = Math.floor(ms / 60000)
  const hours = Math.floor(ms / 3600000)
  const days = Math.floor(ms / 86400000)
  
  if (lang === 'sw') {
    if (mins < 1) return 'Sasa'
    if (mins < 60) return `${mins}m`
    if (hours < 24) return `${hours}h`
    return `${days}d`
  }
  
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  if (hours < 24) return `${hours}h`
  return `${days}d`
}

export default function FeedCard({ item, isBookmarked, onBookmark, onDeepDive, onImageClick, index = 0, lang = 'en' }: FeedCardProps) {
  const handleBookmark = () => {
    if (isBookmarked) {
      removeBookmarkData(item.id)
    } else {
      saveBookmarkData(item.id, item)
    }
    onBookmark()
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: sanitizeHtml(item.title, 200), url: item.sourceUrl })
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(item.sourceUrl)
    }
  }

  const safeTitle = sanitizeHtml(item.title, 200)
  const safeContent = sanitizeHtml(item.content, 200)
  const safeSourceName = sanitizeHtml(item.sourceName, 50)

  const hasImage = !!item.thumbnail

  return (
    <motion.article
      className="x-card"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.3) }}
    >
      <div className="x-card-layout">
        {/* Content side */}
        <div className="x-card-content">
          {/* Source and time */}
          <div className="x-card-meta">
            <span className="x-source">
              {item.sourceIcon && (
                <img src={item.sourceIcon} alt="" className="x-source-icon" onError={(e) => e.currentTarget.style.display = 'none'} />
              )}
              <span className="x-source-name">{safeSourceName}</span>
            </span>
            <span className="x-dot"></span>
            <span className="x-time">
              <Clock size={11} />
              {getTimeAgo(item.publishedAt, lang)}
            </span>
          </div>

          {/* Title */}
          <h2 className="x-title">
            <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">
              {safeTitle}
            </a>
          </h2>

          {/* Content excerpt */}
          {safeContent && (
            <p className="x-excerpt">{safeContent}</p>
          )}

          {/* Actions */}
          <div className="x-actions">
            <button
              id={`share-${item.id}`}
              onClick={handleShare}
              className="x-action-btn"
              title="Share"
            >
              <Share2 size={14} />
            </button>
            <button
              id={`bookmark-${item.id}`}
              onClick={handleBookmark}
              className="x-action-btn"
              title={isBookmarked ? 'Remove' : 'Save'}
            >
              <Heart size={14} fill={isBookmarked ? '#ef4444' : 'none'} color={isBookmarked ? '#ef4444' : 'currentColor'} />
            </button>
            {onDeepDive && (
              <button
                onClick={() => onDeepDive(item)}
                className="x-action-btn x-action-ai"
                title={lang === 'sw' ? 'Kwa nini?' : 'Why?'}
              >
                <Sparkles size={14} />
              </button>
            )}
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="x-read-btn"
            >
              <ExternalLink size={12} />
              <span>{lang === 'sw' ? 'Soma' : 'Read'}</span>
            </a>
          </div>
        </div>

        {/* Image side */}
        {hasImage && (
          <div 
            className="x-card-image x-card-image-clickable"
            onClick={() => onImageClick?.(item.thumbnail!)}
          >
            <img
              src={item.thumbnail}
              alt=""
              loading="lazy"
            />
            <div className="x-image-zoom-hint">
              <ExternalLink size={12} />
            </div>
          </div>
        )}
      </div>
    </motion.article>
  )
}
