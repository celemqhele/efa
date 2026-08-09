'use client'

import { useEffect, useState } from 'react'
import { Bell, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const STORAGE_KEY = 'efa-push-dismissed'

export default function PushNotificationInit() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    if (Notification.permission === 'denied') return

    const supabase = createClient()

    async function sync() {
      if (Notification.permission !== 'granted') {
        if (localStorage.getItem(STORAGE_KEY)) return
        setShow(true)
        return
      }
      const { data } = await supabase.auth.getSession()
      if (!data.session) return
      await registerAndSubscribe()
    }

    sync()

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      sync()
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  async function registerAndSubscribe() {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
      const currentKey = urlBase64ToUint8Array(vapidKey)

      const existing = await reg.pushManager.getSubscription()
      if (existing) {
        const existingKey = existing.getKey('applicationServerKey' as unknown as PushEncryptionKeyName)
        const matches =
          existingKey &&
          existingKey.byteLength === currentKey.byteLength &&
          Array.from(new Uint8Array(existingKey)).every((b, i) => b === currentKey[i])

        if (matches) {
          await saveSubscription(existing)
          return
        }
        await existing.unsubscribe()
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: currentKey,
      })
      await saveSubscription(sub)
    } catch (err) {
      console.warn('Push subscription failed', err)
    }
  }

  async function saveSubscription(sub: PushSubscription) {
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub.toJSON()),
    })
    if (!res.ok) throw new Error(`saveSubscription failed: HTTP ${res.status}`)
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
    <>
      {/* Backdrop — desktop only */}
      <div
        className="hidden sm:block fixed inset-0 bg-black/60 z-[100] animate-fade-in"
        onClick={handleDismiss}
      />

      {/* Popup */}
      <div
        className="
          fixed z-[101]
          inset-x-0 bottom-0 rounded-t-2xl
          sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2
          sm:rounded-2xl sm:max-w-md sm:w-[calc(100vw-2rem)]
          bg-bg-elevated border border-border shadow-2xl
          animate-slide-up
        "
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
            <Bell className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-foreground-primary text-base">
              Enable match notifications
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              Get notified when it&apos;s matchday, when your opponent messages you, and when reminders are due.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 flex gap-3">
          <button
            onClick={handleDismiss}
            className="flex-1 btn-outline min-h-[44px] sm:min-h-0 text-sm"
          >
            Not now
          </button>
          <button
            onClick={handleAllow}
            className="flex-1 btn-gold min-h-[44px] sm:min-h-0 text-sm"
          >
            Allow
          </button>
        </div>
      </div>
    </>
  )
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from(Array.from(rawData).map((c) => c.charCodeAt(0)))
}
