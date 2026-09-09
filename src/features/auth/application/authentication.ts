import { createServerFn } from '@tanstack/react-start'
import { useSession } from '@tanstack/react-start/server'
import { z } from 'zod'

import {
  createAnonSupabaseClient,
  createRequestSupabaseClient,
} from '@/shared/lib/supabase/server/create-server-client'

import type { AuthSessionData } from '../domain/auth'
import { authMiddleware } from '../infrastructure/server/auth-middleware'
import { authSessionConfig, toAuthSessionData } from '../infrastructure/server/session'

export const loginInput = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(256),
  rememberSession: z.boolean().default(false),
})

export const login = createServerFn({ method: 'POST' })
  .validator(loginInput)
  .handler(async ({ data }) => {
    const { data: result, error } = await createAnonSupabaseClient().auth.signInWithPassword(data)
    if (error || !result.session) return { ok: false as const }

    const session = await useSession<AuthSessionData>(authSessionConfig(data.rememberSession))
    await session.update(toAuthSessionData(result.session))
    return { ok: true as const }
  })

export const logout = createServerFn({ method: 'POST' })
  .validator(z.object({}))
  .handler(async () => {
    const session = await useSession<AuthSessionData>(authSessionConfig())
    if (session.data.accessToken) {
      await createRequestSupabaseClient(session.data.accessToken).auth.signOut({ scope: 'local' })
    }
    await session.clear()
    return { ok: true as const }
  })

export interface CurrentUser {
  displayName: string
  email: string
}

export function displayNameForUser(email: string, metadata: unknown): string {
  if (!metadata || typeof metadata !== 'object') return email

  const displayName = (metadata as Record<string, unknown>).display_name
  return typeof displayName === 'string' && displayName.trim() ? displayName.trim() : email
}

/** Returns the signed-in user's public identity without exposing the session token to the browser. */
export const getCurrentUser = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<CurrentUser> => {
    const { data, error } = await createAnonSupabaseClient().auth.getUser(
      context.principal.accessToken,
    )
    if (error || !data.user?.email) throw new Response('Unauthenticated', { status: 401 })

    return {
      displayName: displayNameForUser(data.user.email, data.user.user_metadata),
      email: data.user.email,
    }
  })
