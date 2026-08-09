'use client'
import PushShooterClient from './PushShooterClient'

export default function Mobile({ data }: { data: any }) {
  return (
    <div className="px-4 pb-8">
      <PushShooterClient subscribedCount={data.subscribedCount} />
    </div>
  )
}
