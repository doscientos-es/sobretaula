export interface VenueMetric {
  venueId: string
  venueName: string
  netSalesCents: number
  contributionCents: number
  wasteCents: number
}
export interface VenueBenchmark extends VenueMetric {
  contributionPercent: number
  wastePercent: number
  rank: number
}
export function benchmarkVenues(metrics: readonly VenueMetric[]): VenueBenchmark[] {
  return [...metrics]
    .sort((a, b) => b.contributionCents - a.contributionCents)
    .map((metric, index) => ({
      ...metric,
      contributionPercent: metric.netSalesCents
        ? (metric.contributionCents / metric.netSalesCents) * 100
        : 0,
      wastePercent: metric.netSalesCents ? (metric.wasteCents / metric.netSalesCents) * 100 : 0,
      rank: index + 1,
    }))
}
