/**
 * Displays generic password-feedback progress without owning any password policy.
 * This component is intentionally self-contained so it can move to `@doscientos/ui`.
 */
export function PasswordRequirementsIndicator({
  isValid,
  label,
  progress,
}: {
  /** Whether every requirement supplied by the consumer is met. */
  isValid: boolean
  /** Accessible status and native hover tooltip supplied by the consumer. */
  label: string
  /** Completion percentage, clamped to the visible 0–100 range. */
  progress: number
}) {
  const normalizedProgress = Math.max(0, Math.min(100, progress))
  const color = isValid ? 'var(--success)' : 'var(--primary)'

  return (
    <span
      aria-label={label}
      className="grid size-4 place-items-center rounded-full"
      data-slot="password-requirements-indicator"
      role="status"
      style={{
        background: `conic-gradient(${color} ${normalizedProgress}%, var(--border) ${normalizedProgress}% 100%)`,
      }}
      title={label}
    >
      <span aria-hidden="true" className="size-2 rounded-full bg-white" />
    </span>
  )
}
