import { useEffect, useState } from 'react'

import {
  getPushNotificationConfig,
  removePushSubscription,
  savePushSubscription,
} from '@/features/notifications'
import { useLocale } from '@/shared/lib/i18n/locale-preference'
import { createTranslator } from '@/shared/lib/i18n/messages'

function decodeBase64Url(value: string): ArrayBuffer {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replaceAll('-', '+').replaceAll('_', '/')
  const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

function subscriptionData(subscription: PushSubscription) {
  const json = subscription.toJSON()
  if (!json.endpoint || !json.keys?.auth || !json.keys.p256dh) return null
  return {
    auth: json.keys.auth,
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    userAgent: navigator.userAgent,
  }
}

export function PushNotificationPreferences() {
  const locale = useLocale('es')
  const t = createTranslator(locale)
  const [available, setAvailable] = useState<boolean | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      getPushNotificationConfig(),
      'serviceWorker' in navigator ? navigator.serviceWorker.ready : Promise.resolve(null),
    ]).then(async ([config, registration]) => {
      if (cancelled) return
      const supported =
        Boolean(config.publicKey) &&
        'Notification' in window &&
        'PushManager' in window &&
        Boolean(registration)
      setAvailable(supported)
      if (supported && registration) {
        setEnabled(Boolean(await registration.pushManager.getSubscription()))
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function enable() {
    setPending(true)
    setError(false)
    try {
      const config = await getPushNotificationConfig()
      if (!config.publicKey || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        setAvailable(false)
        return
      }
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        applicationServerKey: decodeBase64Url(config.publicKey),
        userVisibleOnly: true,
      })
      const data = subscriptionData(subscription)
      if (!data) throw new Error('push_subscription_payload_missing')
      await savePushSubscription({ data })
      setEnabled(true)
    } catch {
      setError(true)
    } finally {
      setPending(false)
    }
  }

  async function disable() {
    setPending(true)
    setError(false)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        await removePushSubscription({ data: { endpoint: subscription.endpoint } })
        await subscription.unsubscribe()
      }
      setEnabled(false)
    } catch {
      setError(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">{t('settings.notifications.description')}</p>
      {available === false ? (
        <p className="text-muted-foreground">{t('settings.notifications.unavailable')}</p>
      ) : (
        <button
          className="bg-primary text-primary-foreground rounded-lg px-3 py-2 font-medium disabled:opacity-60"
          disabled={pending || available === null}
          onClick={() => void (enabled ? disable() : enable())}
          type="button"
        >
          {enabled ? t('settings.notifications.disable') : t('settings.notifications.enable')}
        </button>
      )}
      {error ? <p className="text-destructive">{t('settings.notifications.error')}</p> : null}
    </div>
  )
}
