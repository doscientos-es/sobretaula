import { registerPwaServiceWorker } from '@doscientos/pwa/core'
import { usePwaInstallPrompt } from '@doscientos/pwa/react'
import { useEffect } from 'react'

import { useLocale } from '@/shared/lib/i18n/locale-preference'
import { createTranslator } from '@/shared/lib/i18n/messages'

export function PwaRuntime() {
  const locale = useLocale('es')
  const t = createTranslator(locale)
  const { dismiss, install, isIos, pending, visible } = usePwaInstallPrompt({
    storageKey: 'sobretaula:pwa-install-dismissed',
  })

  useEffect(() => registerPwaServiceWorker({ scriptUrl: '/sw.js' }), [])

  if (!visible) return null

  return (
    <aside
      aria-label={t('pwa.install.title')}
      className="bg-card fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-md items-start gap-3 rounded-xl border p-4 shadow-[var(--ui-shadow-floating)] sm:inset-x-auto sm:right-4 sm:left-auto"
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium">{t('pwa.install.title')}</p>
        <p className="text-muted-foreground mt-1 text-sm">
          {isIos ? t('pwa.install.iosDescription') : t('pwa.install.description')}
        </p>
      </div>
      {!isIos && (
        <button
          className="bg-primary text-primary-foreground shrink-0 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-60"
          disabled={pending}
          onClick={() => void install()}
          type="button"
        >
          {t('pwa.install.action')}
        </button>
      )}
      <button
        aria-label={t('pwa.install.dismiss')}
        className="text-muted-foreground shrink-0 rounded-md px-1 text-lg leading-none"
        onClick={dismiss}
        type="button"
      >
        ×
      </button>
    </aside>
  )
}
