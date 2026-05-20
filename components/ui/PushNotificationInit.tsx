'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'efa-push-dismissed'

export default function PushNotificationInit() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    // Only run in browser, only if SW + Push supported
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    if (Notification.permission === 'granted') {
      // Already granted — silently subscribe in case SW changed
      registerAndSubscribe()
      return
    }
    if (Notification.permission === 'denied') return
    if (localStorage.getItem(STORAGE_KEY)) return
    // Show our prompt
    setShow(true)
  }, [])

  async function registerAndSubscribe() {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      const existing = await reg.pushManager.getSubscription()
      if (existing) {
        await saveSubscription(existing)
        return
      }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })
      await saveSubscription(sub)
    } catch (err) {
      console.warn('Push subscription failed', err)
    }
  }

  async function saveSubscription(sub: PushSubscription) {
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub.toJSON()),
    })
  }

  async function handleAllow() {
    setShow(false)
    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      await registerAndSubscribe()
    } else {
      localStorage.setItem(STORAGE_KEY, '1')
    }
  }

  function handleDismiss() {
    setShow(false)
    localStorage.setItem(STORAGE_KEY, '1')
  }

  if (!show) return null

  return (
    <div className="fixed bottom-20 lg:bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100vw-2rem)] max-w-md">
      <div className="card border border-gold/40 p-4 shadow-2xl shadow-black/40 flex items-start gap-3 animate-slide-up">
        <span className="text-2xl shrink-0">🔔</span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-900 text-sm">Enable match notifications</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Get notified when it&apos;s matchday, when your opponent messages you, and when reminders are due.
          </p>
          <div className="flex gap-2 mt-3">
            <button onClick={handleAllow} className="btn-gold text-xs px-4 py-1.5">
              Allow
            </button>
            <button onClick={handleDismiss} className="text-xs text-slate-500 hover:text-slate-700 px-2">
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}
