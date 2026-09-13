type PublicReservationFailure =
  | 'detailsInvalid'
  | 'rateLimited'
  | 'selectionUnavailable'
  | 'slotTaken'
  | 'termsUnavailable'
  | 'unknown'

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (!error || typeof error !== 'object') return ''
  const message = (error as { message?: unknown }).message
  return typeof message === 'string' ? message : ''
}

function errorStatus(error: unknown): number | undefined {
  if (error instanceof Response) return error.status
  if (!error || typeof error !== 'object') return undefined
  const candidate = error as { status?: unknown; statusCode?: unknown }
  return typeof candidate.status === 'number'
    ? candidate.status
    : typeof candidate.statusCode === 'number'
      ? candidate.statusCode
      : undefined
}

/** Identifies expected public-booking failures after server-function serialization. */
export function publicReservationFailure(error: unknown): PublicReservationFailure {
  const status = errorStatus(error)
  const message = errorMessage(error)

  if (status === 409 || message.includes('Slot unavailable')) return 'slotTaken'
  if (status === 429 || message.includes('Too many attempts')) return 'rateLimited'
  if (status === 422 || message.includes('Terms version unavailable')) return 'termsUnavailable'
  if (status === 404 || message.includes('Not found')) return 'selectionUnavailable'
  if (/ZodError|validation|invalid_type/i.test(message)) return 'detailsInvalid'
  return 'unknown'
}
