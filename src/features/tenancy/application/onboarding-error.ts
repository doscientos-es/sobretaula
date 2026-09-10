/** Converts expected provisioning failures into instructions the owner can act on. */
export function tenantOnboardingErrorMessage(error: unknown): string {
  if (error instanceof Response) {
    if (error.status === 401)
      return 'Tu sesión ha caducado. Inicia sesión de nuevo para guardar el restaurante.'
    if (error.status === 409)
      return 'Esta dirección de SobreTaula ya está en uso. Elige otra diferente.'
    if (error.status === 422)
      return 'Revisa la dirección de SobreTaula y los datos de facturación antes de continuar.'
    if (error.status === 503)
      return 'El alta está temporalmente en preparación. Espera unos minutos e inténtalo de nuevo.'
  }

  return 'No se ha podido guardar el alta. Comprueba tu conexión e inténtalo de nuevo.'
}
