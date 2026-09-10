import { Button } from '@doscientos/ui'
import type { QueryClient } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  HeadContent,
  Link,
  Outlet,
  Scripts,
} from '@tanstack/react-router'
import { CircleAlert, House, RefreshCw, Utensils } from 'lucide-react'
import { useSyncExternalStore, type ReactNode } from 'react'

import { isPasswordRecoveryHash, PasswordResetPage } from '@/features/auth'
import { DEFAULT_LOCALE } from '@/shared/lib/i18n/locale'
import { createTranslator } from '@/shared/lib/i18n/messages'

import appCss from '../styles.css?url'

const t = createTranslator(DEFAULT_LOCALE)

function subscribeToLocationHash(onStoreChange: () => void): () => void {
  window.addEventListener('hashchange', onStoreChange)
  return () => window.removeEventListener('hashchange', onStoreChange)
}

function isPasswordRecoveryLocation(): boolean {
  return typeof window !== 'undefined' && isPasswordRecoveryHash(window.location.hash)
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    links: [{ href: appCss, rel: 'stylesheet' }],
    meta: [
      { charSet: 'utf-8' },
      { content: 'width=device-width, initial-scale=1', name: 'viewport' },
      { content: 'noindex,nofollow', name: 'robots' },
      { title: 'SobreTaula' },
    ],
  }),
  component: RootLayout,
  errorComponent: RootError,
  notFoundComponent: NotFound,
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang={DEFAULT_LOCALE}>
      <head>
        <HeadContent />
      </head>
      <body className="min-h-svh">
        {children}
        <Scripts />
      </body>
    </html>
  )
}

function RootLayout() {
  return <Outlet />
}

function RootError({ reset }: { reset: () => void }) {
  const isPasswordRecovery = useSyncExternalStore(
    subscribeToLocationHash,
    isPasswordRecoveryLocation,
    () => false,
  )

  if (isPasswordRecovery) {
    return <PasswordResetPage />
  }

  return (
    <main aria-labelledby="error-title" className="st-error-page">
      <span aria-hidden="true" className="st-error-orb st-error-orb--top" />
      <span aria-hidden="true" className="st-error-orb st-error-orb--bottom" />
      <section aria-live="polite" className="st-error-card">
        <Link aria-label="SobreTaula, inicio" className="st-error-brand" to="/">
          <span className="st-brand-mark">
            <Utensils aria-hidden="true" className="size-5" />
          </span>
          <span>SobreTaula</span>
        </Link>
        <div className="st-error-content">
          <div aria-hidden="true" className="st-error-icon">
            <CircleAlert className="size-7" />
          </div>
          <h1 id="error-title">{t('error.title')}</h1>
          <p id="error-description">{t('error.description')}</p>
          <p className="st-error-reassurance">{t('error.reassurance')}</p>
          <div aria-describedby="error-description" className="st-error-actions">
            <Button className="h-11 px-5" onPress={reset}>
              <RefreshCw aria-hidden="true" className="size-4" />
              {t('error.retry')}
            </Button>
            <Link className="st-error-home-link" to="/">
              <House aria-hidden="true" className="size-4" />
              {t('common.backHome')}
            </Link>
          </div>
        </div>
        <aside aria-label={t('error.help.title')} className="st-error-help">
          <p>{t('error.help.title')}</p>
          <ul>
            <li>{t('error.help.connection')}</li>
            <li>{t('error.help.retry')}</li>
            <li>{t('error.help.support')}</li>
          </ul>
        </aside>
      </section>
    </main>
  )
}

function NotFound() {
  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <section className="bg-card w-full max-w-md rounded-2xl border p-6 text-center shadow-[var(--ui-shadow-surface)]">
        <h1 className="text-2xl font-semibold tracking-[-0.04em]">{t('notFound.title')}</h1>
        <p className="text-muted-foreground mt-3 leading-6">{t('notFound.description')}</p>
        <div className="mt-6">
          <Link to="/" className="text-sm underline">
            {t('common.backHome')}
          </Link>
        </div>
      </section>
    </main>
  )
}
