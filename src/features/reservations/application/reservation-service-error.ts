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

/** Converts service-configuration failures into next steps that staff can act on. */
export function reservationServiceErrorMessage(error: unknown): string {
  const message = errorMessage(error)
  const status = errorStatus(error)

  if (status === 401 || message.includes('Unauthenticated'))
    return 'Tu sesión ha caducado. Inicia sesión de nuevo antes de configurar el turno.'
  if (status === 402 || message.includes('Payment method required'))
    return 'El restaurante todavía no está activo. Completa la configuración de facturación antes de crear turnos.'
  if (status === 403 || message.includes('Forbidden') || message.includes(':42501'))
    return 'Solo las personas propietarias o responsables pueden configurar turnos. Pídeles acceso o que creen el turno.'
  if (message.includes('reservation_service_create_failed:23505'))
    return 'Ya existe un turno con ese nombre para ese día. Edítalo o usa otro nombre.'
  if (message.includes('reservation_service_time_overlap'))
    return 'Ya existe un turno abierto en ese horario para ese día. Ajusta las horas o edita el turno existente.'
  if (status === 404)
    return 'Este turno ya no está disponible. Actualiza la página e inténtalo de nuevo.'
  if (status === 422 || /ZodError|validation|invalid_type/i.test(message))
    return 'Revisa el nombre, día, horarios e intervalos del turno antes de guardarlo.'

  return 'No se ha podido guardar el turno. Comprueba tu conexión e inténtalo de nuevo.'
}
