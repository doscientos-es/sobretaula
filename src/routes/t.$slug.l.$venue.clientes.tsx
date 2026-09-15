import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/t/$slug/l/$venue/clientes')({
  loader: ({ context }) => ({ tenant: context.tenant, venue: context.venue }),
})
