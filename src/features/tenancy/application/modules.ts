import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

import { MODULE_KEYS, type ModuleKey } from '../domain/modules'
import { tenantMembershipMiddleware } from './require-tenant-membership'

const input = z.object({ tenantId: z.string().uuid() })

/** Resolves subscription entitlements once, keeping core available as the safety default. */
export const getTenantModules = createServerFn({ method: 'GET' })
  .middleware([authMiddleware, tenantMembershipMiddleware])
  .validator(input)
  .handler(async ({ context, data }): Promise<ModuleKey[]> => {
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('plan_id')
      .eq('tenant_id', data.tenantId)
      .maybeSingle()
    if (subscriptionError)
      throw new Error(`tenant_modules_subscription_failed:${subscriptionError.code}`)
    if (!subscription?.plan_id) return ['core']

    const { data: entitlements, error } = await supabase
      .from('plan_entitlements')
      .select('module_code')
      .eq('plan_id', subscription.plan_id)
    if (error) throw new Error(`tenant_modules_entitlements_failed:${error.code}`)

    const enabled = new Set<ModuleKey>(['core'])
    for (const row of entitlements ?? []) {
      if (MODULE_KEYS.includes(row.module_code as ModuleKey))
        enabled.add(row.module_code as ModuleKey)
    }
    const { data: overrides, error: overridesError } = await supabase
      .from('tenant_module_overrides')
      .select('module_code, enabled')
      .eq('tenant_id', data.tenantId)
    if (overridesError) throw new Error(`tenant_modules_overrides_failed:${overridesError.code}`)
    for (const override of overrides ?? []) {
      const moduleKey = override.module_code as ModuleKey
      if (!MODULE_KEYS.includes(moduleKey)) continue
      if (override.enabled) enabled.add(moduleKey)
      else if (moduleKey !== 'core') enabled.delete(moduleKey)
    }
    return [...enabled]
  })
