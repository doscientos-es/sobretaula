import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { LoginPage } from '@/features/auth'

const loginSearch = z.object({ redirect: z.string().optional() })

export const Route = createFileRoute('/login')({
  component: LoginRoute,
  // Login is a small client-only form. Avoid making the public entrypoint
  // preload the authenticated application graph just to SSR this screen.
  ssr: false,
  validateSearch: loginSearch,
})

function LoginRoute() {
  const { redirect } = Route.useSearch()
  return <LoginPage {...(redirect === undefined ? {} : { redirectTo: redirect })} />
}
