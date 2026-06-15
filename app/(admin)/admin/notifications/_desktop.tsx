'use client'
import AdminNotificationsClient from './AdminNotificationsClient'

export default function Desktop({ data }: { data: any }) {
  return (
    <div className="max-w-6xl mx-auto">
      <AdminNotificationsClient
        pendingRequests={data.pendingRequests}
        notifications={data.notifications}
        allUsers={data.allUsers}
      />
    </div>
  )
}
