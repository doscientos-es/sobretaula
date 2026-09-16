import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ActivateAccountPage } from './activate-account-page'
import { PasswordResetPage } from './password-reset-page'

describe('authentication action pages', () => {
  it('uses the shared access-flow treatment when resetting a password', () => {
    const markup = renderToStaticMarkup(<PasswordResetPage />)

    expect(markup).toContain('st-auth-action-shell')
    expect(markup).toContain('SobreTaula')
    expect(markup).toContain('Enlace seguro')
  })

  it('identifies account activation as a team invitation', () => {
    const markup = renderToStaticMarkup(
      <ActivateAccountPage
        invitationPath="/invitacion"
        invitationToken="test-token"
      />,
    )

    expect(markup).toContain('st-auth-action-card')
    expect(markup).toContain('Invitación al equipo')
  })
})