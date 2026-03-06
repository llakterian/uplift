import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

export default function InstallBanner() {
    const [prompt, setPrompt] = useState<any>(null)
    const [visible, setVisible] = useState(false)
    const [dismissed, setDismissed] = useState(false)

    useEffect(() => {
        const alreadyDismissed = localStorage.getItem('uplift_install_dismissed')
        if (alreadyDismissed) return

        const handler = (e: Event) => {
            e.preventDefault()
            setPrompt(e)
            // Show banner after 20s of being on the page
            setTimeout(() => setVisible(true), 20000)
        }

        window.addEventListener('beforeinstallprompt', handler)
        return () => window.removeEventListener('beforeinstallprompt', handler)
    }, [])

    const handleInstall = async () => {
        if (!prompt) return
        prompt.prompt()
        const { outcome } = await prompt.userChoice
        setVisible(false)
        if (outcome === 'accepted') localStorage.setItem('uplift_install_dismissed', '1')
    }

    const handleDismiss = () => {
        setVisible(false)
        setDismissed(true)
        localStorage.setItem('uplift_install_dismissed', '1')
    }

    return (
        <AnimatePresence>
            {visible && !dismissed && (
                <motion.div
                    id="install-banner"
                    className="install-banner card"
                    initial={{ opacity: 0, y: 24, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 24, scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                >
                    <div
                        style={{
                            width: 40,
                            height: 40,
                            borderRadius: 10,
                            overflow: 'hidden',
                            flexShrink: 0,
                            boxShadow: 'var(--shadow-sm)',
                        }}
                    >
                        <img src="/logo.jpg" alt="Uplift" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                            style={{
                                fontFamily: "'Plus Jakarta Sans', sans-serif",
                                fontWeight: 700,
                                fontSize: '0.875rem',
                                color: 'var(--text-primary)',
                                marginBottom: 2,
                            }}
                        >
                            Install Uplift
                        </p>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            Add to your home screen for a native app experience
                        </p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                            id="install-confirm-btn"
                            className="btn btn-primary"
                            onClick={handleInstall}
                            style={{ padding: '0.5rem 1rem' }}
                        >
                            Install
                        </button>
                        <button
                            id="install-dismiss-btn"
                            className="btn-icon"
                            onClick={handleDismiss}
                            aria-label="Dismiss install prompt"
                        >
                            <X size={16} style={{ color: 'var(--text-muted)' }} />
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
