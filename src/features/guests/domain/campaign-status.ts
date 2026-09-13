export type CampaignStatus = 'draft' | 'scheduled' | 'sent' | 'paused'
const transitions: Record<CampaignStatus, readonly CampaignStatus[]> = {
  draft: ['scheduled', 'sent'],
  scheduled: ['sent', 'paused'],
  sent: ['paused'],
  paused: ['scheduled', 'sent'],
}
export function canAdvanceCampaign(current: CampaignStatus, next: CampaignStatus): boolean {
  return transitions[current].includes(next)
}
