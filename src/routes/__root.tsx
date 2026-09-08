import {
  Button,
  DataViewState,
  DataViewStateActions,
  DataViewStateDescription,
  DataViewStateTitle,
} from '@doscientos/ui'
import type { QueryClient } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  HeadContent,
  Link,
  Outlet,
  Scripts,
} from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { DEFAULT_LOCALE } from '@/shared/lib/i18n/locale'
import { createTranslator } from '@/shared/lib/i18n/messages'

import appCss from '../styles.css?url'

const t = createTranslator(DEFAULT_LOCALE)

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
  return (
    <DataViewState aria-live="polite">
      <DataViewStateTitle>{t('error.title')}</DataViewStateTitle>
      <DataViewStateDescription>{t('error.description')}</DataViewStateDescription>
      <DataViewStateActions>
        <Button onPress={reset}>{t('error.retry')}</Button>
        <Link to="/" className="text-sm underline">
          {t('common.backHome')}
        </Link>
      </DataViewStateActions>
    </DataViewState>
  )
}

function NotFound() {
  return (
    <DataViewState>
      <DataViewStateTitle>{t('notFound.title')}</DataViewStateTitle>
      <DataViewStateDescription>{t('notFound.description')}</DataViewStateDescription>
      <DataViewStateActions>
        <Link to="/" className="text-sm underline">
          {t('common.backHome')}
        </Link>
      </DataViewStateActions>
    </DataViewState>
  )
}
