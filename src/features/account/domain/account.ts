import { assertMinorUnits, type MinorUnits } from '@/shared/lib/money/money'

export const PAYMENT_METHODS = ['cash', 'card', 'transfer', 'voucher', 'other'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

/** A line already charged to the table: the menu price was frozen when added. */
export interface AccountLine {
  id: string
  name: string
  notes: string | null
  quantity: number
  unitPriceCents: MinorUnits
  vatRateBps: number
}

export interface AccountPayment {
  amountCents: MinorUnits
  id: string
  method: PaymentMethod
  paidAt: string
  tipCents: MinorUnits
}

export interface AccountTotals {
  /** What is left to collect: gross minus payments, tips never count here. */
  balanceCents: MinorUnits
  grossCents: MinorUnits
  netCents: MinorUnits
  paidCents: MinorUnits
  tipCents: MinorUnits
  vatCents: MinorUnits
}

/** Cart prices are VAT-included, so the line gross is just quantity × price. */
export function lineGrossCents(
  line: Pick<AccountLine, 'quantity' | 'unitPriceCents'>,
): MinorUnits {
  return assertMinorUnits(line.quantity * line.unitPriceCents)
}

/** Net inside a VAT-included gross: gross ÷ (1 + rate), rounded to the cent. */
export function lineNetCents(
  line: Pick<AccountLine, 'quantity' | 'unitPriceCents' | 'vatRateBps'>,
): MinorUnits {
  const gross = lineGrossCents(line)
  return assertMinorUnits(Math.round((gross * 10_000) / (10_000 + line.vatRateBps)))
}

export function computeAccountTotals(
  lines: readonly AccountLine[],
  payments: readonly AccountPayment[],
): AccountTotals {
  const grossCents = lines.reduce((sum, line) => sum + lineGrossCents(line), 0)
  const netCents = lines.reduce((sum, line) => sum + lineNetCents(line), 0)
  const paidCents = payments.reduce((sum, payment) => sum + payment.amountCents, 0)
  const tipCents = payments.reduce((sum, payment) => sum + payment.tipCents, 0)
  return {
    balanceCents: grossCents - paidCents,
    grossCents,
    netCents,
    paidCents,
    tipCents,
    vatCents: grossCents - netCents,
  }
}

/**
 * Splits the bill into equal parts in cents; the first parts absorb the
 * remainder one cent each so the parts always add up to the total.
 */
export function splitEvenly(totalCents: MinorUnits, parts: number): MinorUnits[] {
  if (!Number.isInteger(parts) || parts < 1) throw new Error('invalid_split_parts')
  const base = Math.floor(totalCents / parts)
  const remainder = totalCents - base * parts
  return Array.from({ length: parts }, (_, index) => base + (index < remainder ? 1 : 0))
}
