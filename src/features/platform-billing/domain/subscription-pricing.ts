export const INTRODUCTORY_MONTHS = 12
export const INTRODUCTORY_MONTHLY_NET_CENTS = 9_900
export const FOUNDERS_DISCOUNT_BPS = 5_000
export const DEFAULT_VAT_RATE_BPS = 2_100
export const VENUES_INCLUDED_IN_PLAN = 1
export const EXTRA_VENUE_MONTHLY_NET_CENTS = 10_000

export interface SubscriptionPrice {
  netCents: number
  totalCents: number
  vatCents: number
}

function requirePositiveInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`invalid_${field}`)
}

function requireNonNegativeInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`invalid_${field}`)
}

/** Returns the net monthly amount for the currently agreed commercial policy. */
export function monthlyNetCentsForCycle({
  cycle,
  hasFoundersBenefit,
  standardMonthlyNetCents,
}: {
  cycle: number
  hasFoundersBenefit: boolean
  standardMonthlyNetCents: number
}): number {
  requirePositiveInteger(cycle, 'cycle')
  requirePositiveInteger(standardMonthlyNetCents, 'standard_monthly_net_cents')
  if (cycle <= INTRODUCTORY_MONTHS) return INTRODUCTORY_MONTHLY_NET_CENTS
  return hasFoundersBenefit
    ? Math.round((standardMonthlyNetCents * (10_000 - FOUNDERS_DISCOUNT_BPS)) / 10_000)
    : standardMonthlyNetCents
}

/** Surcharge for the venues that the plan price does not already cover. */
export function extraVenueNetCents({
  extraVenueMonthlyNetCents = EXTRA_VENUE_MONTHLY_NET_CENTS,
  venueCount,
}: {
  extraVenueMonthlyNetCents?: number
  venueCount: number
}): number {
  requirePositiveInteger(venueCount, 'venue_count')
  requireNonNegativeInteger(extraVenueMonthlyNetCents, 'extra_venue_monthly_net_cents')
  return Math.max(0, venueCount - VENUES_INCLUDED_IN_PLAN) * extraVenueMonthlyNetCents
}

/**
 * Net monthly amount billed to the company. Introductory and Founders benefits
 * only affect the plan price: every additional venue is charged in full.
 */
export function subscriptionMonthlyNetCents({
  cycle,
  extraVenueMonthlyNetCents = EXTRA_VENUE_MONTHLY_NET_CENTS,
  hasFoundersBenefit,
  standardMonthlyNetCents,
  venueCount,
}: {
  cycle: number
  extraVenueMonthlyNetCents?: number
  hasFoundersBenefit: boolean
  standardMonthlyNetCents: number
  venueCount: number
}): number {
  return (
    monthlyNetCentsForCycle({ cycle, hasFoundersBenefit, standardMonthlyNetCents }) +
    extraVenueNetCents({ extraVenueMonthlyNetCents, venueCount })
  )
}

/** Taxes are calculated from integer cents, never floats. */
export function priceWithVat({
  netCents,
  vatRateBps = DEFAULT_VAT_RATE_BPS,
}: {
  netCents: number
  vatRateBps?: number
}): SubscriptionPrice {
  requirePositiveInteger(netCents, 'net_cents')
  if (!Number.isSafeInteger(vatRateBps) || vatRateBps < 0 || vatRateBps > 10_000)
    throw new Error('invalid_vat_rate_bps')
  const vatCents = Math.round((netCents * vatRateBps) / 10_000)
  return { netCents, totalCents: netCents + vatCents, vatCents }
}
