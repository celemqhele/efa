'use client'
import AdminNotificationsClient from './AdminNotificationsClient'

export default function Mobile({ data }: { data: any }) {
  return (
    <div className="px-4 pb-8 space-y-5">
      <div className="bg-bg-elevated border border-border rounded-xl p-4">
        <h2 className="text-base font-semibold text-text-primary">Notifications & Requests</h2>
        <p className="text-xs text-text-muted mt-1">
          {data.pendingRequests?.length ?? 0} pending request{(data.pendingRequests?.length ?? 0) !== 1 ? 's' : ''}
        </p>
      </div>
      <AdminNotificationsClient
        pendingRequests={data.pendingRequests}
        notifications={data.notifications}
        allUsers={data.allUsers}
      />
    </div>
  )
}
