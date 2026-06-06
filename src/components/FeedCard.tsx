import { useState } from 'react'
import { motion } from 'framer-motion'
import { Heart, ExternalLink, Share2, Sparkles, Bookmark } from 'lucide-react'
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
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(Math.floor(Math.random() * 50) + 3)

  const handleLike = (e: React.MouseEvent) => {
    e.preventDefault()
    setLiked(!liked)
    setLikeCount(c => liked ? c - 1 : c + 1)
  }

  const handleBookmarkClick = () => {
    if (isBookmarked) {
      removeBookmarkData(item.id)
    } else {
      saveBookmarkData(item.id, item)
    }
    onBookmark()
  }

  const handleShare = async () => {
    const shareUrl = `https://uplift.llakterian.workers.dev/share/${item.id}`
    const shareTitle = item.title
    const shareDesc = item.content?.substring(0, 200) || 'Check out this uplifting story on Uplift!'

    if (navigator.share) {
      try {
        await navigator.share({ 
          title: shareTitle, 
          text: shareDesc,
          url: shareUrl 
        })
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(`${shareTitle}\n\n${shareUrl}`)
    }
  }

  const safeTitle = sanitizeHtml(item.title, 300)
  const safeContent = sanitizeHtml(item.content, 800).replace(/<a[^>]*>([^<]*)<\/a>/gi, '$1')
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
        {/* Avatar column */}
        <div className="x-avatar">
          {item.sourceIcon ? (
            <img 
              src={item.sourceIcon} 
              alt="" 
              onError={(e) => { 
                e.currentTarget.style.display = 'none'
                e.currentTarget.parentElement!.querySelector('.fallback')?.classList.remove('hidden')
              }} 
            />
          ) : null}
          <div className={`x-avatar-fallback fallback ${item.sourceIcon ? 'hidden' : ''}`}>
            {item.sourceName.charAt(0).toUpperCase()}
          </div>
        </div>

        {/* Content */}
        <div className="x-card-content">
          {/* Source and time row */}
          <div className="x-card-meta">
            <span className="x-source-name">{safeSourceName}</span>
            <span className="x-dot"></span>
            <span className="x-time">
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

          {/* Image */}
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
            </div>
          )}

          {/* X-style Actions Bar — Reply/Share/Like/Bookmark */}
          <div className="x-post-actions">
            {/* Read / Open */}
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="x-post-action-btn"
              title="Open original"
            >
              <ExternalLink size={15} />
            </a>

            {/* Share */}
            <button
              onClick={handleShare}
              className="x-post-action-btn green"
              title="Share"
            >
              <Share2 size={15} />
            </button>

            {/* AI Deep Dive */}
            {onDeepDive && (
              <button
                onClick={() => onDeepDive(item)}
                className="x-post-action-btn"
                title={lang === 'sw' ? 'Kwa nini?' : 'Why this?'}
              >
                <Sparkles size={15} />
              </button>
            )}

            {/* Like */}
            <button
              onClick={handleLike}
              className={`x-post-action-btn pink ${liked ? 'text-pink-500' : ''}`}
              title="Like"
            >
              <Heart size={15} fill={liked ? '#f91880' : 'none'} color={liked ? '#f91880' : 'currentColor'} />
              <span className="text-[12px]">{likeCount}</span>
            </button>

            {/* Bookmark */}
            <button
              onClick={handleBookmarkClick}
              className={`x-post-action-btn ${isBookmarked ? 'text-[var(--brand-x)]' : ''}`}
              title="Bookmark"
            >
              <Bookmark size={15} fill={isBookmarked ? 'var(--brand-x)' : 'none'} />
            </button>
          </div>
        </div>
      </div>
    </motion.article>
  )
}