import {
  PASSWORD_MIN_LENGTH,
  passwordRequirements,
} from '../domain/password-policy'

/** Shows the status of the password policy without exposing the password itself. */
export function PasswordRequirementsIndicator({
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
  const message = isValid
    ? 'Contraseña válida'
    : `Falta: ${unmetRequirements.join('. ')}.`
  const color = isValid ? '#21835b' : '#c7503d'

  return (
    <span
      aria-label={message}
      className="absolute inset-y-0 right-3 m-auto grid size-4 place-items-center rounded-full"
      role="img"
      style={{ background: `conic-gradient(${color} ${progress}%, #e8e8e9 ${progress}% 100%)` }}
      title={message}
    >
      <span aria-hidden="true" className="size-2 rounded-full bg-white" />
    </span>
  )
}
