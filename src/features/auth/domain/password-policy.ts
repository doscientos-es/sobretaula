export const PASSWORD_MIN_LENGTH = 12
export const PASSWORD_MAX_LENGTH = 256

export interface PasswordRequirement {
  label: string
  met: boolean
}

/** Returns the versioned password requirements used by the registration UI and API. */
export function passwordRequirements(
  password: string,
  confirmation?: string,
): PasswordRequirement[] {
  const requirements = [
    {
      label: `Al menos ${PASSWORD_MIN_LENGTH} caracteres`,
      met: password.length >= PASSWORD_MIN_LENGTH,
    },
  ]

  if (confirmation !== undefined) {
    requirements.push({
      label: 'Las contraseñas coinciden',
      met: password.length > 0 && password === confirmation,
    })
  }

  return requirements
}
