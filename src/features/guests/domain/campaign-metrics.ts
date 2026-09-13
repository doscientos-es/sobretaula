export interface CampaignRecipientMetric {
  status: string
  attributedRevenueCents: number
}
export function calculateCampaignMetrics(recipients: readonly CampaignRecipientMetric[]) {
  return {
    recipients: recipients.length,
    sent: recipients.filter(
      (recipient) => recipient.status !== 'pending' && recipient.status !== 'opted_out',
    ).length,
    conversions: recipients.filter((recipient) => recipient.attributedRevenueCents > 0).length,
    attributedRevenueCents: recipients.reduce(
      (total, recipient) => total + recipient.attributedRevenueCents,
      0,
    ),
  }
}
