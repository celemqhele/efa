'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from './Button'

interface Props {
  managerId: string
  managerUsername: string
}

export default function MessageManagerButton({ managerId, managerUsername }: Props) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleClick = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ other_user_id: managerId }),
      })
      if (res.status === 401) {
        router.push('/login')
        return
      }
      const { id } = await res.json()
      router.push(`/messages/${id}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleClick}
      isLoading={loading}
      variant="secondary"
      className="text-xs flex items-center gap-1.5"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
      {loading ? 'Opening…' : `Message @${managerUsername}`}
    </Button>
  )
}
