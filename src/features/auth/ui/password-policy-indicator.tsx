import { PASSWORD_MIN_LENGTH, passwordRequirements } from '../domain/password-policy'
import { PasswordRequirementsIndicator } from './password-requirements-indicator'

/** Connects SobreTaula's password policy to the generic visual indicator. */
export function PasswordPolicyIndicator({
  confirmation,
  password,
}: {
  confirmation?: string
  password: string
}) {
  const requirements = passwordRequirements(password, confirmation)
  const isValid = requirements.every((requirement) => requirement.met)
  const lengthProgress = Math.min(1, password.length / PASSWORD_MIN_LENGTH)
  const confirmationProgress =
    confirmation === undefined ? 1 : Number(password.length > 0 && password === confirmation)
  const progress =
    confirmation === undefined
      ? lengthProgress * 100
      : ((lengthProgress + confirmationProgress) / requirements.length) * 100
  const unmetRequirements = requirements
    .filter((requirement) => !requirement.met)
    .map((requirement) => requirement.label)
  const label = isValid ? 'Contraseña válida' : `Falta: ${unmetRequirements.join('. ')}.`

  return (
    <span className="absolute inset-y-0 right-3 m-auto">
      <PasswordRequirementsIndicator isValid={isValid} label={label} progress={progress} />
    </span>
  )
}
