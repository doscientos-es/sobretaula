import { createMiddleware, createServerOnlyFn } from '@tanstack/react-start'

import {
  createAnonSupabaseClient,
  createServiceSupabaseClient,
} from '@/shared/lib/supabase/server/create-server-client'

import type { AuthPrincipal, AuthSessionData } from '../../domain/auth'
import { authSessionConfig, toAuthSessionData } from './session'

const TOKEN_REFRESH_SKEW_SECONDS = 60

const readAuthSession = createServerOnlyFn(async () => {
  const { useSession } = await import('@tanstack/react-start/server')
  return useSession<AuthSessionData>(authSessionConfig())
})

/** Resolves and refreshes the httpOnly session for server functions and server routes. */
export async function getAuthenticatedPrincipal(e2eRole?: string): Promise<AuthPrincipal> {
  if (process.env.E2E_TEST_MODE === 'true' && e2eRole) {
    const email = process.env[`E2E_${e2eRole.toUpperCase()}_EMAIL`]
    if (email) {
      const { data, error } = await createServiceSupabaseClient().auth.admin.listUsers({
        perPage: 1000,
      })
      const user = data.users.find(
        (candidate) => candidate.email?.toLowerCase() === email.toLowerCase(),
      )
      if (!error && user) {
        return { accessToken: process.env.SUPABASE_SECRET_KEY ?? '', userId: user.id }
      }
    }
  }
  const session = await readAuthSession()
  const current = session.data

  if (!current.accessToken || !current.refreshToken || !current.expiresAt) {
    throw new Response('Unauthenticated', { status: 401 })
  }

  let accessToken = current.accessToken
  const supabase = createAnonSupabaseClient()

  if (current.expiresAt <= Math.floor(Date.now() / 1000) + TOKEN_REFRESH_SKEW_SECONDS) {
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: current.refreshToken,
    })
    if (error || !data.session) {
      await session.clear()
      throw new Response('Unauthenticated', { status: 401 })
    }

    const refreshed = toAuthSessionData(data.session)
    await session.update(refreshed)
    accessToken = refreshed.accessToken
  }

  const { data, error } = await supabase.auth.getUser(accessToken)
  if (error || !data.user) {
    await session.clear()
    throw new Response('Unauthenticated', { status: 401 })
  }

  return { accessToken, userId: data.user.id }
}

export const authMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next, request }) => {
    const principal = await getAuthenticatedPrincipal(
      request.headers.get('x-e2e-role') ?? undefined,
    )
    return next({ context: { principal } })
  },
)
