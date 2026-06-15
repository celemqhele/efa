'use client'
import AdminNotificationsClient from './AdminNotificationsClient'

export default function Mobile({ data }: { data: any }) {
  return (
    <div className="px-3 pb-6">
      <AdminNotificationsClient
        pendingRequests={data.pendingRequests}
        notifications={data.notifications}
        allUsers={data.allUsers}
      />
    </div>
  )
}
