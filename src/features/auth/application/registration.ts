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

export type RegistrationErrorCode =
  | 'email_invalid'
  | 'email_exists'
  | 'password_weak'
  | 'rate_limited'
  | 'unavailable'

function registrationErrorCode(error: {
  code?: string | undefined
  status?: number | undefined
  message?: string | undefined
}): RegistrationErrorCode {
  const code = error.code?.toLowerCase() ?? ''
  const message = error.message?.toLowerCase() ?? ''

  if (
    code === 'email_address_invalid' ||
    code === 'invalid_email' ||
    message.includes('email address')
  ) {
    return 'email_invalid'
  }
  if (
    code === 'user_already_exists' ||
    code === 'email_exists' ||
    message.includes('already registered') ||
    message.includes('already exists')
  ) {
    return 'email_exists'
  }
  if (code === 'weak_password' || error.status === 422 || message.includes('password')) {
    return 'password_weak'
  }
  if (error.status === 429 || code.includes('rate_limit')) return 'rate_limited'
  return 'unavailable'
}

/** Creates the restaurant owner's account without exposing administrative credentials. */
export const register = createServerFn({ method: 'POST' })
  .validator(registrationInput)
  .handler(async ({ data }) => {
    const { data: result, error } = await createAnonSupabaseClient().auth.signUp({
      email: data.email,
      password: data.password,
      options: { data: { display_name: data.displayName } },
    })
    if (error || !result.user) {
      return {
        ok: false as const,
        errorCode: registrationErrorCode(error ?? { message: 'missing_user' }),
      }
    }
    if (!result.session) return { ok: true as const, requiresEmailConfirmation: true as const }

    const session = await useSession<AuthSessionData>(authSessionConfig())
    await session.update(toAuthSessionData(result.session))
    return { ok: true as const, requiresEmailConfirmation: false as const }
  })

const externalSessionInput = z.object({
  accessToken: z.string().min(1).max(8192),
  refreshToken: z.string().min(1).max(8192),
})

/** Verifies an Auth email-link session before copying it into the server-only session cookie. */
export const completeExternalAuthSession = createServerFn({ method: 'POST' })
  .validator(externalSessionInput)
  .handler(async ({ data }) => {
    const client = createAnonSupabaseClient()
    const { data: sessionData, error: sessionError } = await client.auth.setSession({
      access_token: data.accessToken,
      refresh_token: data.refreshToken,
    })
    if (sessionError || !sessionData.session) return { ok: false as const }
    const { error: userError } = await client.auth.getUser(sessionData.session.access_token)
    if (userError) return { ok: false as const }

    const session = await useSession<AuthSessionData>(authSessionConfig())
    await session.update(toAuthSessionData(sessionData.session))
    return { ok: true as const }
  })
