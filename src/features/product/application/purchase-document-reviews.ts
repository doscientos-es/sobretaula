import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import {
  operationalTenantMiddleware,
  tenantMembershipMiddleware,
} from '@/features/tenancy/application/require-tenant-membership'
import { paginationRange, type PaginatedResult } from '@/shared/lib/pagination'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

import { parsePurchaseDocumentExtraction } from '../domain/purchase-document-extraction'
const middleware = [
  authMiddleware,
  tenantMembershipMiddleware,
  operationalTenantMiddleware,
] as const
const base = z.object({ tenantId: z.string().uuid(), venueId: z.string().uuid() })
const listInput = base.extend({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
})
export const listPurchaseDocumentReviews = createServerFn({ method: 'GET' })
  .middleware(middleware)
  .validator(listInput)
  .handler(
    async ({
      context,
      data,
    }): Promise<
      PaginatedResult<{
        id: string
        fileName: string
        status: string
        extraction: ReturnType<typeof parsePurchaseDocumentExtraction>
        objectPath: string | null
        createdAt: string
      }>
    > => {
      const range = paginationRange(data)
      const {
        data: rows,
        error,
        count,
      } = await createRequestSupabaseClient(context.tenantMembership.accessToken)
        .from('purchase_document_reviews')
        .select('id, file_name, status, extraction, object_path, created_at', { count: 'exact' })
        .eq('tenant_id', data.tenantId)
        .eq('venue_id', data.venueId)
        .order('created_at', { ascending: false })
        .range(range.from, range.to)
      if (error) throw new Error(`purchase_document_reviews_load_failed:${error.code}`)
      const items = (rows ?? []).map((row) => ({
        id: row.id as string,
        fileName: row.file_name as string,
        status: row.status as string,
        extraction: parsePurchaseDocumentExtraction(row.extraction),
        objectPath: (row.object_path as string | null) ?? null,
        createdAt: row.created_at as string,
      }))
      return {
        items,
        page: data.page,
        pageSize: data.pageSize,
        total: count ?? items.length,
        hasMore: data.page * data.pageSize < (count ?? items.length),
      }
    },
  )
export const reviewPurchaseDocument = createServerFn({ method: 'POST' })
  .middleware(middleware)
  .validator(
    base.extend({ documentId: z.string().uuid(), status: z.enum(['approved', 'rejected']) }),
  )
  .handler(async ({ context, data }) => {
    if (!['owner', 'manager'].includes(context.tenantMembership.role))
      throw new Response('Forbidden', { status: 403 })
    const { data: reviewed, error } = await createRequestSupabaseClient(
      context.tenantMembership.accessToken,
    )
      .from('purchase_document_reviews')
      .update({
        status: data.status,
        reviewed_by: context.tenantMembership.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', data.documentId)
      .eq('tenant_id', data.tenantId)
      .eq('venue_id', data.venueId)
      .eq('status', 'needs_review')
      .select('id')
      .maybeSingle()
    if (error) throw new Error(`purchase_document_review_failed:${error.code}`)
    if (!reviewed) throw new Error('purchase_document_not_pending')
    return { saved: true }
  })

export const getPurchaseDocumentUrl = createServerFn({ method: 'GET' })
  .middleware(middleware)
  .validator(base.extend({ documentId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: row, error } = await supabase
      .from('purchase_document_reviews')
      .select('object_path')
      .eq('id', data.documentId)
      .eq('tenant_id', data.tenantId)
      .eq('venue_id', data.venueId)
      .maybeSingle()
    if (error || !row?.object_path) throw new Error('purchase_document_not_found')
    const signed = await supabase.storage
      .from('purchase_documents')
      .createSignedUrl(row.object_path, 300)
    if (signed.error || !signed.data?.signedUrl) throw new Error('purchase_document_url_failed')
    return { url: signed.data.signedUrl }
  })

export const applyPurchaseDocumentReview = createServerFn({ method: 'POST' })
  .middleware(middleware)
  .validator(
    base.extend({
      documentId: z.string().uuid(),
      supplierId: z.string().uuid(),
      reference: z.string().trim().min(1).max(120),
      receivedOn: z.string().date(),
      mappings: z
        .array(
          z.object({
            lineIndex: z.number().int().min(0).max(499),
            ingredientId: z.string().uuid(),
          }),
        )
        .min(1)
        .max(500),
    }),
  )
  .handler(async ({ context, data }) => {
    if (!['owner', 'manager'].includes(context.tenantMembership.role))
      throw new Response('Forbidden', { status: 403 })
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: review, error: reviewError } = await supabase
      .from('purchase_document_reviews')
      .select('id, status, extraction')
      .eq('id', data.documentId)
      .eq('tenant_id', data.tenantId)
      .eq('venue_id', data.venueId)
      .maybeSingle()
    if (reviewError || !review) throw new Error('purchase_document_not_found')
    if (review.status !== 'approved') throw new Error('purchase_document_must_be_approved')
    const extraction = parsePurchaseDocumentExtraction(review.extraction)
    const mapped = new Map(
      data.mappings.map((mapping) => [mapping.lineIndex, mapping.ingredientId]),
    )
    const lines = extraction.lines.map((line, index) => ({
      ingredient_id: mapped.get(index),
      quantity: line.quantity,
      unit_cost_cents: Math.round(line.unitCostCents),
    }))
    if (lines.some((line) => !line.ingredient_id))
      throw new Error('purchase_document_line_mapping_required')
    const { data: note, error: noteError } = await supabase
      .from('delivery_notes')
      .insert({
        tenant_id: data.tenantId,
        venue_id: data.venueId,
        supplier_id: data.supplierId,
        reference: data.reference,
        received_on: data.receivedOn,
        notes: `Importado de documento revisado ${data.documentId}`,
        purchase_document_review_id: data.documentId,
        created_by: context.tenantMembership.userId,
      })
      .select('id')
      .single()
    if (noteError || !note) {
      if (noteError?.code === '23505') return { alreadyApplied: true }
      throw new Error(`purchase_document_apply_failed:${noteError?.code ?? 'unknown'}`)
    }
    const { error: linesError } = await supabase
      .from('delivery_note_lines')
      .insert(
        lines.map((line) => ({ ...line, delivery_note_id: note.id, tenant_id: data.tenantId })),
      )
    if (linesError) {
      await supabase.from('delivery_notes').delete().eq('id', note.id)
      throw new Error(`purchase_document_lines_failed:${linesError.code}`)
    }
    return { alreadyApplied: false, deliveryNoteId: note.id as string }
  })
