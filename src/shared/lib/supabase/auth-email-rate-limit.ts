function recordFrom(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as unknown as Record<string, unknown>)
    : undefined
}

/** Identifies Supabase Auth email quotas without depending on its error class. */
export function isAuthEmailRateLimited(error: unknown): boolean {
  const details = recordFrom(error)
  return details?.status === 429 || details?.code === 'over_email_send_rate_limit'
}

/** Identifies the rate-limit response returned by invitation server functions. */
export function isInvitationEmailRateLimited(error: unknown): boolean {
  return error instanceof Response && error.status === 429
}

export const invitationEmailRateLimitMessage =
  'Se ha alcanzado temporalmente el límite de correos. La invitación queda pendiente: espera un poco e inténtalo de nuevo.'
