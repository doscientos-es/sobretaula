import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedPrincipal } from '@/features/auth/infrastructure/server/auth-middleware'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

const MAX_FILE_BYTES = 15 * 1024 * 1024
const MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])

export const Route = createFileRoute('/api/t/$tenantId/purchase-document')({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        if (request.headers.get('origin') !== new URL(request.url).origin)
          return new Response('Forbidden', { status: 403 })
        try {
          const principal = await getAuthenticatedPrincipal()
          const supabase = createRequestSupabaseClient(principal.accessToken)
          const { data: membership } = await supabase
            .from('memberships')
            .select('role')
            .eq('tenant_id', params.tenantId)
            .eq('user_id', principal.userId)
            .eq('status', 'active')
            .maybeSingle()
          if (!membership || !['owner', 'manager'].includes(membership.role))
            return new Response('Forbidden', { status: 403 })
          const form = await request.formData()
          const venueId = form.get('venueId')
          const file = form.get('file')
          if (
            typeof venueId !== 'string' ||
            !(file instanceof File) ||
            file.size === 0 ||
            file.size > MAX_FILE_BYTES ||
            !MIME_TYPES.has(file.type)
          )
            return new Response('Invalid purchase document', { status: 400 })
          const { data: venue } = await supabase
            .from('venues')
            .select('id')
            .eq('id', venueId)
            .eq('tenant_id', params.tenantId)
            .maybeSingle()
          if (!venue) return new Response('Forbidden', { status: 403 })
          const id = crypto.randomUUID()
          const objectPath = `${params.tenantId}/${venueId}/${id}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
          const uploaded = await supabase.storage
            .from('purchase_documents')
            .upload(objectPath, file, { contentType: file.type, upsert: false })
          if (uploaded.error)
            return new Response('purchase_document_upload_failed', { status: 500 })
          const { error } = await supabase.from('purchase_document_reviews').insert({
            id,
            tenant_id: params.tenantId,
            venue_id: venueId,
            file_name: file.name,
            content_type: file.type,
            object_path: objectPath,
            extraction: {
              lines: [],
              documentNumber: null,
              documentDate: null,
              supplierName: null,
              confidence: 0,
            },
          })
          if (error) {
            await supabase.storage.from('purchase_documents').remove([objectPath])
            return new Response('purchase_document_record_failed', { status: 500 })
          }
          return Response.json({ ok: true, id })
        } catch (error) {
          if (error instanceof Response) return error
          return new Response('Purchase document upload failed', { status: 500 })
        }
      },
    },
  },
})
