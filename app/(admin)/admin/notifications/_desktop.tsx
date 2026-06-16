'use client'
import AdminNotificationsClient from './AdminNotificationsClient'

export default function Desktop({ data }: { data: any }) {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <AdminNotificationsClient
        pendingRequests={data.pendingRequests}
        notifications={data.notifications}
        allUsers={data.allUsers}
      />
    </div>
  )
}
