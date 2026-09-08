import { createServerFn } from '@tanstack/react-start'
import { useSession } from '@tanstack/react-start/server'
import { z } from 'zod'

import {
  createAnonSupabaseClient,
  createRequestSupabaseClient,
} from '@/shared/lib/supabase/server/create-server-client'

import type { AuthSessionData } from '../domain/auth'
import { authSessionConfig, toAuthSessionData } from '../infrastructure/server/session'

const loginInput = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(256),
})

export const login = createServerFn({ method: 'POST' })
  .validator(loginInput)
  .handler(async ({ data }) => {
    const { data: result, error } = await createAnonSupabaseClient().auth.signInWithPassword(data)
    if (error || !result.session) return { ok: false as const }

    const session = await useSession<AuthSessionData>(authSessionConfig())
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
