export interface SalesPayment { method: string; amountCents: number }
export interface SoldProduct { name: string; quantity: number; amountCents: number; vatRateBps: number }
export interface ProductSummary { name: string; quantity: number; amountCents: number }
export function summarizeProducts(products: readonly SoldProduct[]): ProductSummary[] {
  const byName = new Map<string, ProductSummary>()
  for (const product of products) { const current = byName.get(product.name) ?? { name: product.name, quantity: 0, amountCents: 0 }; byName.set(product.name, { name: product.name, quantity: current.quantity + product.quantity, amountCents: current.amountCents + product.amountCents }) }
  return [...byName.values()].sort((left, right) => right.amountCents - left.amountCents)
}
export function aggregateSales(payments: readonly SalesPayment[], products: readonly SoldProduct[], ticketCount = new Set(products.map((product) => product.name)).size) {
  const byMethod: Record<string, number> = {}
  for (const payment of payments) byMethod[payment.method] = (byMethod[payment.method] ?? 0) + payment.amountCents
  const grossCents = payments.reduce((sum, payment) => sum + payment.amountCents, 0)
  const vatCents = products.reduce((sum, product) => sum + Math.round((product.amountCents * product.vatRateBps) / (10_000 + product.vatRateBps)), 0)
  return { grossCents, byMethod, vatCents, ticketAverageCents: ticketCount ? Math.round(grossCents / ticketCount) : 0 }
}
