import { PageHeader, PageHeaderTitle } from '@doscientos/ui'

import { createTranslator } from '@/shared/lib/i18n/messages'

import type { Tenant } from '../domain/tenant'

export function TenantHomePage({ tenant }: { tenant: Tenant }) {
  const t = createTranslator(tenant.defaultLocale)

  return (
    <section className="space-y-4">
      <PageHeader>
        <PageHeaderTitle>{tenant.name}</PageHeaderTitle>
      </PageHeader>
      <p className="text-muted-foreground text-sm">{t('app.tagline')}</p>
      <dl className="grid gap-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Zona horaria</dt>
          <dd>{tenant.timezone}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Idioma</dt>
          <dd>{tenant.defaultLocale}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Estado</dt>
          <dd>{tenant.status}</dd>
        </div>
      </dl>
    </section>
  )
}
