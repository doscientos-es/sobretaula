import { assertMinorUnits, type MinorUnits } from '@/shared/lib/money/money'

export const PAYMENT_METHODS = [
  'cash',
  'card',
  'transfer',
  'voucher',
  'gift_card',
  'other',
] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]
export const KITCHEN_STATIONS = ['general', 'hot', 'cold', 'bar', 'dessert'] as const
export type KitchenStation = (typeof KITCHEN_STATIONS)[number]
export const ORDER_ITEM_STATUSES = ['pending', 'preparing', 'ready', 'served', 'cancelled'] as const
export type OrderItemStatus = (typeof ORDER_ITEM_STATUSES)[number]

export function canAdvanceOrderItemStatus(from: OrderItemStatus, to: OrderItemStatus): boolean {
  if (from === 'cancelled' || from === 'served') return false
  return (
    (from === 'pending' && to === 'preparing') ||
    (from === 'preparing' && to === 'ready') ||
    (from === 'ready' && to === 'served') ||
    to === 'cancelled'
  )
}

/** A line already charged to the table: the menu price was frozen when added. */
export interface AccountLine {
  id: string
  status?: OrderItemStatus
  kitchenStation?: KitchenStation
  name: string
  modifiers?: readonly AccountModifier[]
  preparationMinutes?: number
  notes: string | null
  quantity: number
  unitPriceCents: MinorUnits
  vatRateBps: number
}

export interface AccountModifier {
  id: string
  name: string
  priceDeltaCents: MinorUnits
}

export interface AccountPayment {
  amountCents: MinorUnits
  id: string
  method: PaymentMethod
  paidAt: string
  tipCents: MinorUnits
  refundedCents?: MinorUnits
}

/** Lines still travelling to the server keep a client id until the reload. */
export const OPTIMISTIC_LINE_ID_PREFIX = 'optimistic-'

export function isOptimisticAccountLine(line: Pick<AccountLine, 'id'>): boolean {
  return line.id.startsWith(OPTIMISTIC_LINE_ID_PREFIX)
}

/** The same dish apuntado varias veces: one entry with the accumulated count. */
export interface AccountLineGroup {
  key: string
  line: AccountLine
  lines: AccountLine[]
  quantity: number
}

function accountLineGroupKey(line: AccountLine): string {
  const modifiers = (line.modifiers ?? [])
    .map((modifier) => modifier.id)
    .sort()
    .join(',')
  return [
    line.name,
    line.notes ?? '',
    line.unitPriceCents,
    line.vatRateBps,
    line.kitchenStation ?? 'general',
    line.status ?? 'pending',
    modifiers,
  ].join('|')
}

/**
 * Groups identical lines so repeating a dish raises a counter instead of
 * filling the account with duplicated entries. Order of first appearance wins.
 */
export function groupAccountLines(lines: readonly AccountLine[]): AccountLineGroup[] {
  const groups = new Map<string, AccountLineGroup>()
  for (const line of lines) {
    const key = accountLineGroupKey(line)
    const current = groups.get(key)
    if (current) {
      current.lines.push(line)
      current.quantity += line.quantity
      continue
    }
    groups.set(key, { key, line, lines: [line], quantity: line.quantity })
  }
  return [...groups.values()]
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
  line: Pick<AccountLine, 'modifiers' | 'quantity' | 'unitPriceCents'>,
): MinorUnits {
  const modifierTotal = (line.modifiers ?? []).reduce(
    (sum, modifier) => sum + modifier.priceDeltaCents,
    0,
  )
  return assertMinorUnits(line.quantity * (line.unitPriceCents + modifierTotal))
}

/** Net inside a VAT-included gross: gross ÷ (1 + rate), rounded to the cent. */
export function lineNetCents(
  line: Pick<AccountLine, 'modifiers' | 'quantity' | 'unitPriceCents' | 'vatRateBps'>,
): MinorUnits {
  const gross = lineGrossCents(line)
  return assertMinorUnits(Math.round((gross * 10_000) / (10_000 + line.vatRateBps)))
}

export function computeAccountTotals(
  lines: readonly AccountLine[],
  payments: readonly AccountPayment[],
  discountCents = 0,
): AccountTotals {
  const chargeableLines = lines.filter((line) => line.status !== 'cancelled')
  const grossCents = chargeableLines.reduce((sum, line) => sum + lineGrossCents(line), 0)
  const netCents = chargeableLines.reduce((sum, line) => sum + lineNetCents(line), 0)
  const paidCents = payments.reduce(
    (sum, payment) => sum + payment.amountCents - (payment.refundedCents ?? 0),
    0,
  )
  const tipCents = payments.reduce((sum, payment) => sum + payment.tipCents, 0)
  return {
    balanceCents: Math.max(0, grossCents - discountCents - paidCents),
    grossCents: Math.max(0, grossCents - discountCents),
    netCents,
    paidCents,
    tipCents,
    vatCents: Math.max(0, grossCents - discountCents - netCents),
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

export function splitByPercentages(
  totalCents: MinorUnits,
  percentages: readonly number[],
): MinorUnits[] {
  if (!percentages.length || percentages.some((value) => value < 0 || !Number.isFinite(value)))
    throw new Error('invalid_split_percentages')
  const total = percentages.reduce((sum, value) => sum + value, 0)
  if (Math.abs(total - 100) > 0.0001) throw new Error('split_percentages_must_equal_100')
  const shares = percentages.map((value) => Math.floor((totalCents * value) / 100))
  let remainder = totalCents - shares.reduce((sum, value) => sum + value, 0)
  return shares.map((share) => {
    if (remainder > 0) {
      remainder -= 1
      return share + 1
    }
    return share
  })
}

export function splitByAmounts(totalCents: MinorUnits, amounts: readonly number[]): MinorUnits[] {
  if (!amounts.length || amounts.some((value) => !Number.isInteger(value) || value < 0))
    throw new Error('invalid_split_amounts')
  if (amounts.reduce((sum, value) => sum + value, 0) !== totalCents)
    throw new Error('split_amounts_must_equal_total')
  return [...amounts]
}

export function splitByProducts(
  lines: readonly AccountLine[],
  assignments: readonly (readonly string[])[],
): MinorUnits[] {
  const lineById = new Map(lines.map((line) => [line.id, line]))
  const assigned = new Set<string>()
  return assignments.map((personLineIds) => {
    let total = 0
    for (const lineId of personLineIds) {
      if (assigned.has(lineId)) throw new Error('split_product_assigned_twice')
      const line = lineById.get(lineId)
      if (!line) throw new Error('split_product_not_found')
      if (line.status === 'cancelled') throw new Error('split_cancelled_product')
      assigned.add(lineId)
      total += lineGrossCents(line)
    }
    return total
  })
}
