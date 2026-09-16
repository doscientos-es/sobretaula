import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { PlatformInvitationPage } from './platform-invitation-page'

describe('PlatformInvitationPage', () => {
  it('uses the shared invitation treatment and distinguishes global access', () => {
    const markup = renderToStaticMarkup(
      <PlatformInvitationPage token="test-token" />,
    )

    expect(markup).toContain('st-auth-action-shell')
    expect(markup).toContain('Permiso global')
    expect(markup).toContain('Aceptar acceso de plataforma')
  })
})