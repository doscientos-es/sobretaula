export type TenantOnboardingStep = 1 | 2 | 3
export type TenantOnboardingStageStatus = 'done' | 'active' | 'upcoming'

export const TENANT_ONBOARDING_STAGES = [
  'onboarding.step.restaurant',
  'onboarding.step.billing',
  'onboarding.step.activation',
] as const

export function tenantOnboardingStageStatus(
  step: TenantOnboardingStep,
  awaitingActivation: boolean,
): TenantOnboardingStageStatus[] {
  const activeStage = awaitingActivation ? 3 : step === 1 ? 1 : 2

  return TENANT_ONBOARDING_STAGES.map((_, index) => {
    const stage = index + 1
    if (stage < activeStage) return 'done'
    if (stage === activeStage) return 'active'
    return 'upcoming'
  })
}