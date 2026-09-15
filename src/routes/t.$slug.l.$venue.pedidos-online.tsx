import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/t/$slug/l/$venue/pedidos-online')({
  loader: ({ context }) => ({ tenant: context.tenant, venue: context.venue }),
})
