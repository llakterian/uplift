import { useState } from 'react'
import { X, CheckCircle } from 'lucide-react'
import { submitJoinRequest } from '../services/circleApi'
import { CATEGORIES } from '../types'

interface JoinCircleModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function JoinCircleModal({ isOpen, onClose }: JoinCircleModalProps) {
  const [handle, setHandle] = useState('')
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [selectedCats, setSelectedCats] = useState<string[]>([])
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('submitting')
    try {
      await submitJoinRequest({ x_handle: handle, name, bio, categories: selectedCats })
      setStatus('success')
    } catch (err: any) {
      setStatus('error')
      setErrorMsg(err.message || 'Failed to submit request')
    }
  }

  const toggleCat = (id: string) => {
    setSelectedCats(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="card w-full max-w-md relative overflow-hidden" style={{ padding: '24px' }}>
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          <X size={20} />
        </button>

        {status === 'success' ? (
          <div className="text-center py-8">
            <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-display font-bold mb-2">Request Submitted!</h2>
            <p className="text-[var(--text-secondary)] text-sm mb-6">
              You will be reviewed by an admin and added to the Circle soon. Keep spreading positivity!
            </p>
            <button onClick={onClose} className="btn btn-primary w-full justify-center">Close</button>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-display font-bold mb-1">Join Creators Circle</h2>
            <p className="text-[var(--text-muted)] text-sm mb-6">Connect with uplifting East African creators.</p>

            {status === 'error' && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-sm rounded-lg mb-4">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">X (Twitter) Handle *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] font-medium">@</span>
                  <input 
                    type="text" 
                    required 
                    value={handle}
                    onChange={(e) => setHandle(e.target.value.replace('@', ''))}
                    className="w-full bg-[var(--bg-muted)] border border-[var(--border)] rounded-lg py-2.5 pl-8 pr-3 text-[var(--text-primary)] text-sm focus:border-azure focus:outline-none transition-colors"
                    placeholder="username"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">Display Name *</label>
                <input 
                  type="text" 
                  required 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[var(--bg-muted)] border border-[var(--border)] rounded-lg py-2.5 px-3 text-[var(--text-primary)] text-sm focus:border-azure focus:outline-none transition-colors"
                  placeholder="Your Name"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">Bio (Optional)</label>
                <textarea 
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={2}
                  className="w-full bg-[var(--bg-muted)] border border-[var(--border)] rounded-lg py-2.5 px-3 text-[var(--text-primary)] text-sm focus:border-azure focus:outline-none transition-colors resize-none"
                  placeholder="What kind of positivity do you share?"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">Content Focus</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => toggleCat(cat.id)}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all ${
                        selectedCats.includes(cat.id) 
                          ? 'bg-azure/10 text-azure border border-azure/30' 
                          : 'bg-[var(--bg-muted)] text-[var(--text-muted)] border border-transparent hover:text-[var(--text-secondary)]'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <button 
                type="submit" 
                disabled={status === 'submitting'}
                className="btn btn-primary w-full justify-center mt-2"
                style={{ padding: '12px', fontSize: '14px' }}
              >
                {status === 'submitting' ? 'Submitting...' : 'Apply to Join'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
