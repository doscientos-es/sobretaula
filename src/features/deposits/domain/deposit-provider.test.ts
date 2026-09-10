import { describe, expect, it } from 'vitest'

import { validateDepositAmount } from './deposit-provider'
describe('validateDepositAmount', () => {
  it('accepts positive integer cents', () =>
    expect(() => validateDepositAmount(2500)).not.toThrow())
  it('rejects zero, negatives and fractions', () => {
    expect(() => validateDepositAmount(0)).toThrow()
    expect(() => validateDepositAmount(-1)).toThrow()
    expect(() => validateDepositAmount(1.5)).toThrow()
  })
})
