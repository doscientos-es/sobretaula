import { createServerFn } from '@tanstack/react-start'
import { useSession } from '@tanstack/react-start/server'
import { z } from 'zod'

import { createAnonSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

import type { AuthSessionData } from '../domain/auth'
import { authSessionConfig, toAuthSessionData } from '../infrastructure/server/session'

export const registrationInput = z.object({
  displayName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(12).max(256),
})

/** Creates the restaurant owner's account without exposing administrative credentials. */
export const register = createServerFn({ method: 'POST' })
  .validator(registrationInput)
  .handler(async ({ data }) => {
    const { data: result, error } = await createAnonSupabaseClient().auth.signUp({
      email: data.email,
      password: data.password,
      options: { data: { display_name: data.displayName } },
    })
    if (error || !result.user) return { ok: false as const }
    if (!result.session) return { ok: true as const, requiresEmailConfirmation: true as const }

    const session = await useSession<AuthSessionData>(authSessionConfig())
    await session.update(toAuthSessionData(result.session))
    return { ok: true as const, requiresEmailConfirmation: false as const }
  })
