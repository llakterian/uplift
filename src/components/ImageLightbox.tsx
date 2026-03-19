import { motion, AnimatePresence } from 'framer-motion'
import { X, ZoomIn, ZoomOut, Download } from 'lucide-react'
import { useState } from 'react'

interface ImageLightboxProps {
  src: string
  alt?: string
  onClose: () => void
}

export default function ImageLightbox({ src, alt = '', onClose }: ImageLightboxProps) {
  const [scale, setScale] = useState(1)

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = src
    link.download = 'uplift-image'
    link.click()
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="lightbox-overlay"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="lightbox-content"
          onClick={e => e.stopPropagation()}
        >
          <div className="lightbox-toolbar">
            <div className="lightbox-controls">
              <button onClick={() => setScale(s => Math.max(0.5, s - 0.25))} title="Zoom out">
                <ZoomOut size={18} />
              </button>
              <span className="lightbox-zoom-level">{Math.round(scale * 100)}%</span>
              <button onClick={() => setScale(s => Math.min(3, s + 0.25))} title="Zoom in">
                <ZoomIn size={18} />
              </button>
            </div>
            <div className="lightbox-actions">
              <button onClick={handleDownload} title="Download">
                <Download size={18} />
              </button>
              <button onClick={onClose} title="Close">
                <X size={20} />
              </button>
            </div>
          </div>
          <div className="lightbox-image-container">
            <img
              src={src}
              alt={alt}
              style={{ transform: `scale(${scale})` }}
              className="lightbox-image"
            />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
