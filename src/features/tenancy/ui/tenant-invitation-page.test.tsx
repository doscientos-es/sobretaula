import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { TenantInvitationPage } from './tenant-invitation-page'

describe('TenantInvitationPage', () => {
  it('uses the shared invitation treatment and clear acceptance action', () => {
    const markup = renderToStaticMarkup(<TenantInvitationPage token="test-token" />)

    expect(markup).toContain('st-auth-action-shell')
    expect(markup).toContain('Invitación al equipo')
    expect(markup).toContain('Aceptar invitación')
  })
})
