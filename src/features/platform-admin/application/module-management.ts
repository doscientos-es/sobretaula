import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

import { createPlatformOwnerClient } from './platform-dashboard'

const moduleCode = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9_]+$/)
const tenantInput = z.object({ tenantId: z.string().uuid() })

export interface PlatformModule {
  code: string
  description: string
  isActive: boolean
  isAddon: boolean
  monthlyPriceCents: number
  name: string
}

export interface TenantModuleRequest {
  createdAt: string
  id: string
  message: string | null
  moduleCode: string
  status: string
  tenantId: string
}

export const getPlatformModules = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<PlatformModule[]> => {
    const supabase = await createPlatformOwnerClient(
      context.principal.accessToken,
      context.principal.userId,
    )
    const { data, error } = await supabase
      .from('module_catalog')
      .select('code, name, description, monthly_price_cents, is_addon, is_active')
      .order('is_addon')
      .order('name')
    if (error) throw new Error(`platform_modules_load_failed:${error.code}`)
    return (data ?? []).map((row) => ({
      code: row.code,
      description: row.description,
      isActive: row.is_active,
      isAddon: row.is_addon,
      monthlyPriceCents: row.monthly_price_cents,
      name: row.name,
    }))
  })

export const setPlatformModule = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(
    z.object({
      code: moduleCode,
      description: z.string().trim().min(1).max(500),
      isActive: z.boolean(),
      monthlyPriceCents: z.number().int().min(0).max(10_000_000),
      name: z.string().trim().min(1).max(120),
    }),
  )
  .handler(async ({ context, data }) => {
    const supabase = await createPlatformOwnerClient(
      context.principal.accessToken,
      context.principal.userId,
    )
    const { error } = await supabase.from('module_catalog').upsert({
      code: data.code,
      description: data.description,
      is_active: data.isActive,
      monthly_price_cents: data.monthlyPriceCents,
      name: data.name,
    })
    if (error) throw new Error(`platform_module_save_failed:${error.code}`)
  })

export const setTenantModuleOverride = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(tenantInput.extend({ enabled: z.boolean(), moduleCode }))
  .handler(async ({ context, data }) => {
    const supabase = await createPlatformOwnerClient(
      context.principal.accessToken,
      context.principal.userId,
    )
    const { error } = await supabase.from('tenant_module_overrides').upsert({
      changed_by: context.principal.userId,
      enabled: data.enabled,
      module_code: data.moduleCode,
      tenant_id: data.tenantId,
    })
    if (error) throw new Error(`tenant_module_override_failed:${error.code}`)
  })

export const requestTenantModule = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(tenantInput.extend({ message: z.string().trim().max(500).optional(), moduleCode }))
  .handler(async ({ context, data }) => {
    const supabase = createRequestSupabaseClient(context.principal.accessToken)
    const { error } = await supabase.from('tenant_module_requests').insert({
      message: data.message,
      module_code: data.moduleCode,
      requested_by: context.principal.userId,
      tenant_id: data.tenantId,
    })
    if (error) throw new Error(`tenant_module_request_failed:${error.code}`)
  })

export const getTenantModuleRequests = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(tenantInput)
  .handler(async ({ context, data }): Promise<TenantModuleRequest[]> => {
    const supabase = createRequestSupabaseClient(context.principal.accessToken)
    const { data: rows, error } = await supabase
      .from('tenant_module_requests')
      .select('id, tenant_id, module_code, status, message, created_at')
      .eq('tenant_id', data.tenantId)
      .order('created_at', { ascending: false })
    if (error) throw new Error(`tenant_module_requests_load_failed:${error.code}`)
    return (rows ?? []).map((row) => ({
      createdAt: row.created_at,
      id: row.id,
      message: row.message,
      moduleCode: row.module_code,
      status: row.status,
      tenantId: row.tenant_id,
    }))
  })
