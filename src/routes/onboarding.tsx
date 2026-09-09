import { createFileRoute, redirect } from '@tanstack/react-router'

import { getUserDestinations, TenantOnboardingPage } from '@/features/tenancy'

export const Route = createFileRoute('/onboarding')({
  loader: async () => {
    try {
      await getUserDestinations()
    } catch (error) {
      if (error instanceof Response && error.status === 401) {
        throw redirect({ to: '/login', search: { redirect: '/onboarding' } })
      }
      throw error
    }
  },
  component: TenantOnboardingPage,
})
