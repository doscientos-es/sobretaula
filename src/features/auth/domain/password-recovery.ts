/** Identifies Supabase's implicit-flow callback for a password recovery email. */
export function isPasswordRecoveryHash(hash: string): boolean {
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)

  return (
    params.get('type') === 'recovery' &&
    Boolean(params.get('access_token')) &&
    Boolean(params.get('refresh_token'))
  )
}
