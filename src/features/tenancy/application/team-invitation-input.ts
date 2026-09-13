import { z } from 'zod'

import { ASSIGNABLE_TENANT_ROLES } from '../domain/team'

const invitationName = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().min(2).max(120).optional(),
)

export const teamInvitationFormInput = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  name: invitationName,
  role: z.enum(ASSIGNABLE_TENANT_ROLES),
})

/** Returns a precise, safe message before a team invitation reaches the server. */
export function teamInvitationFormError(input: {
  email: string
  name: string
  role: string
}): string | null {
  const result = teamInvitationFormInput.safeParse(input)
  if (result.success) return null

  const issue = result.error.issues[0]
  if (issue?.path[0] === 'email') {
    if (!input.email.trim()) return 'Indica el correo del trabajador.'
    return 'Escribe un correo válido, por ejemplo nombre@restaurante.com.'
  }
  if (issue?.path[0] === 'name') {
    if (input.name.trim().length > 120) return 'El nombre no puede superar 120 caracteres.'
    return 'El nombre debe tener al menos 2 caracteres.'
  }
  return 'Selecciona un rol válido para el trabajador.'
}
