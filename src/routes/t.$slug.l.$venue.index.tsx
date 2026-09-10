import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/t/$slug/l/$venue/')({
  loader: ({ params }) => {
    throw redirect({ params, to: '/t/$slug/l/$venue/tpv' })
  },
})
