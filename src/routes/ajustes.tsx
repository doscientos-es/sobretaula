import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { Settings2, Utensils } from 'lucide-react'

import { AppShellFrame } from '@/app/app-shell-frame'
import { CurrentUserSidebar, getCurrentUser } from '@/features/auth'
import { SettingsPage } from '@/features/settings'
import { useLocale } from '@/shared/lib/i18n/locale-preference'
import { createTranslator } from '@/shared/lib/i18n/messages'

export const Route = createFileRoute('/ajustes')({
  loader: async () => {
    try {
      return await getCurrentUser()
    } catch (error) {
      if (error instanceof Response && error.status === 401) {
        throw redirect({ to: '/login', search: { redirect: '/ajustes' } })
      }
      throw error
    }
  },
  component: SettingsRoute,
})

function SettingsRoute() {
  const locale = useLocale('es')
  const t = createTranslator(locale)

  return (
    <AppShellFrame
      className="st-app-frame st-saas-frame"
      contentClassName="mx-auto w-full max-w-5xl p-4 sm:p-6"
      header={
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="st-saas-brand-mark lg:hidden">
            <Utensils className="size-3" />
          </span>
          <p className="st-saas-breadcrumb truncate text-xs">{t('settings.title')}</p>
        </div>
      }
      headerClassName="st-saas-header flex h-11 items-center justify-between px-5 sm:px-6"
      locale={locale}
      mainClassName="st-saas-main min-w-0 flex-1"
      mobileTabs={null}
      sidebar={
        <>
          <Link
            className="st-saas-brand flex items-center gap-2 px-1.5 py-1.5 text-sm font-semibold tracking-tight"
            to="/"
          >
            <span className="st-saas-brand-mark">
              <Utensils className="size-3.5" />
            </span>
            <span>{t('app.name')}</span>
          </Link>
          <nav aria-label={t('common.navigationMenu')} className="mt-6">
            <Link
              activeProps={{ className: 'st-saas-nav-link--active' }}
              className="st-saas-nav-link flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium"
              to="/ajustes"
            >
              <Settings2 className="size-3" /> {t('common.settings')}
            </Link>
          </nav>
          <CurrentUserSidebar locale={locale} />
        </>
      }
      sidebarClassName="st-saas-sidebar hidden w-56 p-3 lg:flex lg:h-svh lg:flex-col"
    >
      <SettingsPage user={Route.useLoaderData()} />
    </AppShellFrame>
  )
}
