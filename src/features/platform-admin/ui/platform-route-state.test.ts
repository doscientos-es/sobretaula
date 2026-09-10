import { describe, expect, it } from 'vitest'

import { platformRouteErrorCopy } from './platform-route-state'

describe('platformRouteErrorCopy', () => {
  it('uses a safe generic message for unexpected failures', () => {
    expect(platformRouteErrorCopy(new Error('database credentials'))).toMatchObject({
      title: 'No se ha podido cargar esta sección',
    })
  })

  it.each([
    [403, 'Acceso no autorizado'],
    [404, 'No hemos encontrado esta información'],
  ])('maps HTTP %i to a useful recovery state', (status, title) => {
    expect(platformRouteErrorCopy(new Response(null, { status }))).toMatchObject({ title })
  })
})
