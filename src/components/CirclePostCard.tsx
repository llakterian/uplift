import { motion } from 'framer-motion'
import { BadgeCheck, ExternalLink } from 'lucide-react'
import { CirclePost } from '../types'
import AmplifyButton from './AmplifyButton'
import { sanitizeHtml } from '../utils/security'

interface CirclePostCardProps {
  post: CirclePost
  index?: number
  userHandle?: string
}

function getTimeAgo(dateString: string): string {
  const ms = Date.now() - new Date(dateString).getTime()
  const mins = Math.floor(ms / 60000)
  const hours = Math.floor(ms / 3600000)
  const days = Math.floor(ms / 86400000)
  
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  if (hours < 24) return `${hours}h`
  return `${days}d`
}

export default function CirclePostCard({ post, index = 0, userHandle }: CirclePostCardProps) {
  const safeContent = sanitizeHtml(post.content, 800)

  return (
    <motion.article
      className="mag-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.05, 0.4), type: 'spring', stiffness: 260, damping: 26 }}
    >
      <div className="x-card-layout">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full overflow-hidden bg-[var(--bg-muted)] flex-shrink-0" style={{ border: '1px solid var(--border)' }}>
          {post.creator.avatar_url ? (
            <img src={post.creator.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)] font-bold text-lg">
              {post.creator.name.charAt(0)}
            </div>
          )}
        </div>
        
        {/* Content */}
        <div className="x-card-content">
          <div className="x-card-meta">
            <span className="x-source-name text-[var(--text-primary)] font-bold text-sm truncate">
              {post.creator.name}
            </span>
            <BadgeCheck size={14} className="text-azure flex-shrink-0" />
            <span className="text-[var(--text-muted)] text-[13px] truncate">@{post.creator.x_handle}</span>
            <div className="x-dot" />
            <span className="x-time text-[13px] hover:underline cursor-pointer">
              {getTimeAgo(post.posted_at)}
            </span>
          </div>

          <p className="text-[14px] text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap mb-2 font-sans" style={{ wordBreak: 'break-word' }}>
            {safeContent}
          </p>

          {/* Media */}
          {post.media_urls && post.media_urls.length > 0 && (
            <div className="rounded-2xl overflow-hidden mt-2 mb-3" style={{ border: '1px solid var(--border)' }}>
              <img src={post.media_urls[0]} alt="" className="w-full max-h-[300px] object-cover" loading="lazy" />
            </div>
          )}

          {/* X Actions Bar */}
          <div className="flex items-center justify-between mt-2 max-w-md text-[var(--text-muted)]">
            <div className="flex items-center gap-1 group cursor-pointer hover:text-green-500 transition-colors">
              <div className="w-2 h-2 rounded-full bg-green-500 group-hover:bg-green-400" />
              <span className="text-[12px] font-bold group-hover:text-green-500">
                {Math.round(post.positivity_score * 100)}% Vibe
              </span>
            </div>
            
            <a 
              href={`https://x.com/${post.creator.x_handle}/status/${post.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[12px] font-medium hover:text-azure transition-colors"
            >
              <ExternalLink size={14} />
              Open
            </a>

            <div className="flex-1 max-w-[140px] flex justify-end">
              <AmplifyButton post={post} userHandle={userHandle} />
            </div>
          </div>
        </div>
      </div>
    </motion.article>
  )
}
