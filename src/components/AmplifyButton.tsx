import { useState } from 'react'
import { Megaphone, Check } from 'lucide-react'
import { trackAmplification } from '../services/circleApi'
import { CirclePost } from '../types'

interface AmplifyButtonProps {
  post: CirclePost
  userHandle?: string
}

export default function AmplifyButton({ post, userHandle = 'uplifter' }: AmplifyButtonProps) {
  const [isAmplifying, setIsAmplifying] = useState(false)
  const [amplified, setAmplified] = useState(false)

  const handleAmplify = async () => {
    setIsAmplifying(true)
    
    const text = `This is beautiful. Highly recommend checking out what @${post.creator.x_handle} is sharing here:\n\n`
    const url = `https://x.com/${post.creator.x_handle}/status/${post.id}`
    const intentUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`
    
    window.open(intentUrl, '_blank')
    
    try {
      await trackAmplification(post.id, userHandle)
      setAmplified(true)
    } catch (e) {
      console.error(e)
    } finally {
      setIsAmplifying(false)
    }
  }

  return (
    <button
      onClick={handleAmplify}
      disabled={isAmplifying || amplified}
      className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-bold transition-all"
      style={{
        backgroundColor: amplified ? 'rgba(34, 197, 94, 0.1)' : 'var(--brand-azure)',
        color: amplified ? 'rgb(34, 197, 94)' : '#fff',
        opacity: isAmplifying ? 0.7 : 1,
        width: '100%',
        justifyContent: 'center'
      }}
    >
      {amplified ? <Check size={14} /> : <Megaphone size={14} />}
      {amplified ? 'Amplified' : isAmplifying ? 'Amplifying' : 'Amplify'}
    </button>
  )
}
