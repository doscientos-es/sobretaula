import { createFileRoute } from '@tanstack/react-router'
import { createServerOnlyFn } from '@tanstack/react-start'
import { z } from 'zod'

import { authSessionConfig, toAuthSessionData } from '@/features/auth/infrastructure/server/session'
import { createAnonSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

const input = z.object({ email: z.string().email(), password: z.string().min(1) })

const readAuthSession = createServerOnlyFn(async () => {
  const { useSession } = await import('@tanstack/react-start/server')
  return useSession(authSessionConfig())
})

export const Route = createFileRoute('/api/e2e-login')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (process.env.NODE_ENV === 'production' || process.env.E2E_TEST_MODE !== 'true') {
          return new Response('Not found', { status: 404 })
        }
        const parsed = input.safeParse(await request.json())
        if (!parsed.success) return new Response('Invalid credentials', { status: 400 })
        const { data, error } = await createAnonSupabaseClient().auth.signInWithPassword(
          parsed.data,
        )
        if (error || !data.session) return new Response('Invalid credentials', { status: 401 })
        const session = await readAuthSession()
        await session.update(toAuthSessionData(data.session))
        return Response.json({ ok: true })
      },
    },
  },
})
