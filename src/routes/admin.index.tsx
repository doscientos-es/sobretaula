import { DataViewState, DataViewStateDescription, DataViewStateTitle } from '@doscientos/ui'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/')({
  component: PlatformConsole,
})

function PlatformConsole() {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <DataViewState>
        <DataViewStateTitle>Consola de plataforma</DataViewStateTitle>
        <DataViewStateDescription>
          Alta de tenants, planes y soporte auditado. Requiere perfil global; pendiente de F1.
        </DataViewStateDescription>
      </DataViewState>
    </main>
  )
}
