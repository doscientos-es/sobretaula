export const STANDARD_MONTHLY_NET_CENTS = 14_900
export const FOUNDERS_MONTHLY_NET_CENTS = 9_900
export const DEFAULT_VAT_RATE_BPS = 2_100
export const VENUES_INCLUDED_IN_PLAN = 1
export const EXTRA_VENUE_MONTHLY_NET_CENTS = 7_500

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

/**
 * Returns the net monthly price for the first venue. Founders keep their
 * published price while their subscription remains active; it is not a
 * temporary discount that later becomes a surprise price increase.
 */
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
  return hasFoundersBenefit ? FOUNDERS_MONTHLY_NET_CENTS : standardMonthlyNetCents
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
 * Net monthly amount billed to the company. The Founders price only affects
 * the first venue; every additional venue is charged in full.
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
