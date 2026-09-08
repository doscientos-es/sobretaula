import { DataViewState, DataViewStateDescription, DataViewStateTitle } from '@doscientos/ui'
import { createFileRoute, redirect } from '@tanstack/react-router'

import { getUserDestinations } from '@/features/tenancy'

export const Route = createFileRoute('/admin/')({
  loader: async () => {
    try {
      if (!(await getUserDestinations()).isPlatformMember)
        throw new Response('Forbidden', { status: 403 })
    } catch (error) {
      if (error instanceof Response && error.status === 401) {
        throw redirect({ to: '/login', search: { redirect: '/admin' } })
      }
      throw error
    }
  },
  component: PlatformConsole,
})

function PlatformConsole() {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <DataViewState>
        <DataViewStateTitle>Consola de plataforma</DataViewStateTitle>
        <DataViewStateDescription>
          Alta de tenants, planes y soporte auditado. Solo para perfiles globales de plataforma.
        </DataViewStateDescription>
      </DataViewState>
    </main>
  )
}
