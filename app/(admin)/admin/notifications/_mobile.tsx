'use client'
import AdminNotificationsClient from './AdminNotificationsClient'

export default function Mobile({ data }: { data: any }) {
  return (
    <AdminNotificationsClient
      pendingRequests={data.pendingRequests}
      notifications={data.notifications}
      allUsers={data.allUsers}
    />
  )
}
