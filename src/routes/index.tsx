import { DataViewState, DataViewStateDescription, DataViewStateTitle } from '@doscientos/ui'
import { createFileRoute } from '@tanstack/react-router'

import { DEFAULT_LOCALE } from '@/shared/lib/i18n/locale'
import { createTranslator } from '@/shared/lib/i18n/messages'

export const Route = createFileRoute('/')({
  component: TenantPicker,
})

function TenantPicker() {
  const t = createTranslator(DEFAULT_LOCALE)

  return (
    <main className="mx-auto max-w-2xl p-6">
      <DataViewState>
        <DataViewStateTitle>{t('tenant.pick.title')}</DataViewStateTitle>
        <DataViewStateDescription>{t('tenant.pick.description')}</DataViewStateDescription>
      </DataViewState>
    </main>
  )
}
