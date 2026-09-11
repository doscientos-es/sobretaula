function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (!error || typeof error !== 'object') return ''

  const message = (error as { message?: unknown }).message
  return typeof message === 'string' ? message : ''
}

/** Returns only a safe environment-variable name, never its value. */
export function missingEnvironmentVariable(error: unknown): string | null {
  const message = errorMessage(error)
  const missingVariable = message.match(/^Falta la variable de entorno ([A-Z][A-Z0-9_]*)\.$/)
  if (missingVariable) return missingVariable[1]

  if (message === 'supabase_public_config_missing') {
    return 'VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY'
  }

  return null
}