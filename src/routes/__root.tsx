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
import { lazy, Suspense, useState, useSyncExternalStore, type ReactNode } from 'react'

import { PwaRuntime } from '@/app/pwa-runtime'
import { missingEnvironmentVariable, safeErrorDetails } from '@/app/root-error'
import { isPasswordRecoveryHash } from '@/features/auth/domain/password-recovery'
import { DEFAULT_LOCALE } from '@/shared/lib/i18n/locale'
import { LocaleProvider } from '@/shared/lib/i18n/locale-preference'
import { createTranslator } from '@/shared/lib/i18n/messages'

import appCss from '../styles.css?url'

const t = createTranslator(DEFAULT_LOCALE)
const PasswordResetPage = lazy(() =>
  import('@/features/auth/ui/password-reset-page').then((module) => ({
    default: module.PasswordResetPage,
  })),
)

function subscribeToLocationHash(onStoreChange: () => void): () => void {
  window.addEventListener('hashchange', onStoreChange)
  return () => window.removeEventListener('hashchange', onStoreChange)
}

function isPasswordRecoveryLocation(): boolean {
  return typeof window !== 'undefined' && isPasswordRecoveryHash(window.location.hash)
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    links: [
      { href: appCss, rel: 'stylesheet' },
      { href: '/manifest.webmanifest', rel: 'manifest' },
      { href: '/icon.svg', rel: 'icon', type: 'image/svg+xml' },
    ],
    meta: [
      { charSet: 'utf-8' },
      { content: 'width=device-width, initial-scale=1', name: 'viewport' },
      { content: 'noindex,nofollow', name: 'robots' },
      { content: '#ff5f4d', name: 'theme-color' },
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
    <html lang={DEFAULT_LOCALE} suppressHydrationWarning>
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
  return (
    <LocaleProvider>
      <Outlet />
      <PwaRuntime />
    </LocaleProvider>
  )
}

function RootError({ error, reset }: { error: unknown; reset: () => void }) {
  const isPasswordRecovery = useSyncExternalStore(
    subscribeToLocationHash,
    isPasswordRecoveryLocation,
    () => false,
  )
  const [incidentId] = useState(
    () => globalThis.crypto?.randomUUID?.() ?? `inc-${Math.random().toString(36).slice(2)}`,
  )

  if (isPasswordRecovery) {
    return (
      <Suspense fallback={<main aria-busy="true" className="min-h-svh" />}>
        <PasswordResetPage />
      </Suspense>
    )
  }

  const missingVariable = missingEnvironmentVariable(error)
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
          <h1 id="error-title">
            {missingVariable ? t('error.configuration.title') : t('error.title')}
          </h1>
          <p id="error-description">
            {missingVariable ? t('error.configuration.description') : t('error.description')}
          </p>
          {missingVariable && (
            <p className="st-error-reassurance" role="alert">
              {t('error.configuration.detail').replace('{variable}', missingVariable)}
            </p>
          )}
          <p className="st-error-reassurance">{t('error.reassurance')}</p>
          <details className="mt-4 text-left text-sm">
            <summary className="cursor-pointer font-medium">Ver detalles técnicos</summary>
            <div className="bg-muted/40 mt-2 rounded-lg border p-3 font-mono text-xs break-words">
              <p>incidente: {incidentId}</p>
              <p>ruta: {typeof window !== 'undefined' ? window.location.pathname : 'servidor'}</p>
              <p>error: {safeErrorDetails(error)}</p>
            </div>
          </details>
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
