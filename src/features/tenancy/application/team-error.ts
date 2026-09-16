import {
  invitationEmailRateLimitMessage,
  isInvitationEmailRateLimited,
} from '@/shared/lib/supabase/auth-email-rate-limit'

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
  if (typeof candidate.status === 'number') return candidate.status
  return typeof candidate.statusCode === 'number' ? candidate.statusCode : undefined
}

/** Describes whether an existing account was added or a new invitation was sent. */
export function teamInvitationSuccessMessage(kind: 'member_added' | 'invitation_sent'): string {
  return kind === 'member_added'
    ? 'La cuenta ya existía y se ha añadido al equipo.'
    : 'Invitación enviada. La persona deberá revisar su correo.'
}

/** Explains safe, recoverable team-management failures, including serialized server errors. */
export function teamErrorMessage(error: unknown): string {
  if (isInvitationEmailRateLimited(error)) return invitationEmailRateLimitMessage
  const message = errorMessage(error)
  const status = errorStatus(error)

  if (message.includes('tenant_invitation_name_required'))
    return 'No existe una cuenta con ese correo. Indica su nombre para enviarle una invitación.'
  if (message.includes('tenant_invitation_delivery_failed'))
    return 'No se pudo enviar la invitación. Comprueba el correo e inténtalo de nuevo.'
  if (message.includes('team_profile_lookup_failed'))
    return 'No se pudo consultar la cuenta del trabajador. Inténtalo de nuevo.'
  if (message.includes('tenant_invitation_save_failed:42501'))
    return 'No tienes permisos para enviar invitaciones en este restaurante.'
  if (message.includes('tenant_invitation_save_failed'))
    return 'No se pudo guardar la invitación. Comprueba que el restaurante esté disponible e inténtalo de nuevo.'
  if (message.includes('team_member_upsert_failed'))
    return 'No se pudo incorporar la cuenta existente. Inténtalo de nuevo o usa una invitación.'
  if (message.includes('membership_not_found'))
    return 'Ese acceso ya no existe o ha cambiado. Actualiza la página e inténtalo de nuevo.'
  if (message.includes('owner_or_self_membership_cannot_be_removed'))
    return 'No puedes eliminar tu propio acceso ni el del propietario.'
  if (status === 401 || message.includes('Unauthenticated'))
    return 'Tu sesión ha caducado. Inicia sesión de nuevo e inténtalo de nuevo.'
  if (status === 403 || message.includes('Forbidden'))
    return 'No tienes permisos para añadir este rol.'
  if (status === 400 || status === 422 || /ZodError|invalid_type|validation/i.test(message))
    return 'Revisa el nombre, el correo y el rol del trabajador antes de añadirlo.'
  if (message.includes('app_url_not_configured') || message.includes('SUPABASE_SECRET_KEY'))
    return 'La gestión de equipo no está configurada correctamente. Contacta con soporte.'
  return 'No se ha podido actualizar el equipo. Revisa tus permisos e inténtalo de nuevo.'
}
