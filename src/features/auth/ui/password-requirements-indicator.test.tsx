import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { PasswordRequirementsIndicator } from './password-requirements-indicator'

describe('PasswordRequirementsIndicator', () => {
  it('exposes the consumer-provided pending status in its tooltip and accessible label', () => {
    const markup = renderToStaticMarkup(
      <PasswordRequirementsIndicator
        isValid={false}
        label="Falta: Al menos 12 caracteres."
        progress={50}
      />,
    )

    expect(markup).toContain('aria-label="Falta: Al menos 12 caracteres."')
    expect(markup).toContain('data-slot="password-requirements-indicator"')
    expect(markup).toContain('role="status"')
    expect(markup).toContain('title="Falta: Al menos 12 caracteres."')
  })

  it('uses the success token when the consumer marks every requirement as valid', () => {
    const markup = renderToStaticMarkup(
      <PasswordRequirementsIndicator isValid label="Contraseña válida" progress={100} />,
    )

    expect(markup).toContain('var(--success)')
  })
})
