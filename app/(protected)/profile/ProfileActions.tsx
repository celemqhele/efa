'use client'

import { useState } from 'react'
import ChangePasswordModal from './ChangePasswordModal'

export default function ProfileActions({ userEmail }: { userEmail: string }) {
  const [showPasswordModal, setShowPasswordModal] = useState(false)

  return (
    <>
      {showPasswordModal && (
        <ChangePasswordModal
          userEmail={userEmail}
          onClose={() => setShowPasswordModal(false)}
        />
      )}

      <div className="card p-5 space-y-3">
        <h2 className="section-header">
          <span>🔐</span> Account Security
        </h2>
        <p className="text-slate-500 text-xs">
          To reset a forgotten password, contact an admin — they can reset it to a default via the database.
        </p>
        <button
          onClick={() => setShowPasswordModal(true)}
          className="btn-outline text-sm"
        >
          Change Password
        </button>
      </div>
    </>
  )
}
