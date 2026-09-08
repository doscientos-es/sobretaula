import { createMiddleware } from '@tanstack/react-start'
import { useSession } from '@tanstack/react-start/server'

import { createAnonSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

import type { AuthPrincipal, AuthSessionData } from '../../domain/auth'
import { authSessionConfig, toAuthSessionData } from './session'

const TOKEN_REFRESH_SKEW_SECONDS = 60

export const authMiddleware = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  const session = await useSession<AuthSessionData>(authSessionConfig())
  const current = session.data

  if (!current.accessToken || !current.refreshToken || !current.expiresAt) {
    throw new Response('Unauthenticated', { status: 401 })
  }

  let accessToken = current.accessToken
  const supabase = createAnonSupabaseClient()

  if (current.expiresAt <= Math.floor(Date.now() / 1000) + TOKEN_REFRESH_SKEW_SECONDS) {
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: current.refreshToken })
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

  const principal: AuthPrincipal = { accessToken, userId: data.user.id }
  return next({ context: { principal } })
})