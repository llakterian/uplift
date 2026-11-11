import { motion } from 'framer-motion'

interface FluidOrbProps {
  size?: number
  className?: string
}

export default function FluidOrb({ size = 64, className = '' }: FluidOrbProps) {
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (reducedMotion) {
    return (
      <div
        className={`rounded-full ${className}`}
        style={{
          width: size,
          height: size,
          background: 'linear-gradient(135deg, var(--brand-x), #1da1f2, #00ba7c)',
          opacity: 0.7,
        }}
      />
    )
  }

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      {/* Layer 1 */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: 'linear-gradient(135deg, #1d9bf0, #00ba7c)',
          filter: `blur(${size * 0.15}px)`,
          mixBlendMode: 'screen',
        }}
        animate={{
          scale: [1, 1.2, 0.95, 1.1, 1],
          borderRadius: ['50%', '45% 55% 60% 40%', '55% 45% 40% 60%', '40% 60% 55% 45%', '50%'],
          rotate: [0, 90, 180, 270, 360],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Layer 2 */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: 'linear-gradient(225deg, #1da1f2, #7856ff)',
          filter: `blur(${size * 0.2}px)`,
          mixBlendMode: 'screen',
          opacity: 0.8,
        }}
        animate={{
          scale: [1.1, 0.9, 1.15, 0.95, 1.1],
          borderRadius: ['55% 45% 40% 60%', '50%', '45% 55% 60% 40%', '50%', '55% 45% 40% 60%'],
          rotate: [360, 270, 180, 90, 0],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Core glow */}
      <motion.div
        className="absolute rounded-full"
        style={{
          top: '25%',
          left: '25%',
          width: '50%',
          height: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(29,155,240,0.4) 100%)',
          filter: `blur(${size * 0.08}px)`,
        }}
        animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  )
}
