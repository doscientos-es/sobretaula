import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
} from '@doscientos/ui'
import { Link } from '@tanstack/react-router'
import { Globe2, ShieldCheck, UserRound } from 'lucide-react'

import type { CurrentUser } from '@/features/auth'
import { LanguageSwitcher } from '@/shared/lib/i18n/language-switcher'
import { useLocale } from '@/shared/lib/i18n/locale-preference'
import { createTranslator } from '@/shared/lib/i18n/messages'

export function SettingsPage({ user }: { user: CurrentUser }) {
  const locale = useLocale('es')
  const t = createTranslator(locale)

  return (
    <main className="st-platform-page mx-auto w-full max-w-4xl space-y-6">
      <PageHeader className="border-border/70 border-b pb-6">
        <div>
          <PageHeaderTitle>{t('settings.title')}</PageHeaderTitle>
          <PageHeaderDescription>{t('settings.description')}</PageHeaderDescription>
        </div>
      </PageHeader>

      <section aria-labelledby="settings-preferences" className="grid gap-4 md:grid-cols-2">
        <h2 className="sr-only" id="settings-preferences">
          {t('settings.preferences')}
        </h2>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe2 aria-hidden="true" className="size-4" />
              {t('settings.language.title')}
            </CardTitle>
            <CardDescription>{t('settings.language.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <LanguageSwitcher />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck aria-hidden="true" className="size-4" />
              {t('settings.cookies.title')}
            </CardTitle>
            <CardDescription>{t('settings.cookies.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">{t('settings.cookies.technical')}</p>
            <Link
              className="text-primary font-medium underline underline-offset-4"
              to="/legal/cookies"
            >
              {t('settings.cookies.viewPolicy')}
            </Link>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound aria-hidden="true" className="size-4" />
              {t('settings.account.title')}
            </CardTitle>
            <CardDescription>{t('settings.account.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-1 text-sm">
              <dt className="text-muted-foreground">{t('settings.account.email')}</dt>
              <dd className="font-medium">{user.email || t('settings.account.noEmail')}</dd>
            </dl>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
