import type { AuthSessionData } from '../../domain/auth'

const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60

export function authSessionConfig() {
  const password = process.env.SESSION_PASSWORD
  if (!password) throw new Error('Falta la variable de entorno SESSION_PASSWORD.')

  return {
    cookie: {
      httpOnly: true,
      path: '/',
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
    },
    maxAge: SESSION_MAX_AGE_SECONDS,
    name: 'sobretaula-session',
    password,
  }
}

export function toAuthSessionData(session: {
  access_token: string
  expires_at?: number | null
  refresh_token: string
}): AuthSessionData {
  return {
    accessToken: session.access_token,
    expiresAt: session.expires_at ?? Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
    refreshToken: session.refresh_token,
  }
}
