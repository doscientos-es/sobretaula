export interface AuthSessionData {
  accessToken: string
  expiresAt: number
  refreshToken: string
}

export interface AuthPrincipal {
  accessToken: string
  userId: string
}

export function isSafeInternalRedirect(value: string | undefined): value is string {
  return Boolean(value && value.startsWith('/') && !value.startsWith('//'))
}
