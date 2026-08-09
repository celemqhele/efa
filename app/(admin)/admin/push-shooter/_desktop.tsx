'use client'
import PushShooterClient from './PushShooterClient'

export default function Desktop({ data }: { data: any }) {
  return (
    <div className="max-w-3xl mx-auto">
      <PushShooterClient subscribedCount={data.subscribedCount} />
    </div>
  )
}
