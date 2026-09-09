import { createServiceSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

/** One fiscal document row with its storage handle; read is tenant-scoped by RLS. */
export async function findInvoiceDocument(
  supabase: ReturnType<typeof createServiceSupabaseClient>,
  invoiceId: string,
  tenantId: string,
): Promise<{ objectPath: string; contentHash: string } | null> {
  const { data, error } = await supabase
    .from('invoice_documents')
    .select('object_path, content_hash')
    .eq('invoice_id', invoiceId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (error) throw new Error(`invoice_document_lookup_failed:${error.code}`)
  if (!data) return null
  return { contentHash: data.content_hash as string, objectPath: data.object_path as string }
}

/** Registers a freshly uploaded document; unique per invoice and path. */
export async function saveInvoiceDocument(
  supabase: ReturnType<typeof createServiceSupabaseClient>,
  invoiceId: string,
  tenantId: string,
  objectPath: string,
  contentHash: string,
): Promise<void> {
  const { error } = await supabase.from('invoice_documents').insert({
    content_hash: contentHash,
    invoice_id: invoiceId,
    object_path: objectPath,
    tenant_id: tenantId,
  })
  if (error) throw new Error(`invoice_document_save_failed:${error.code}`)
}

/** Signed URL valid for a short time; the PDF never crosses the client bundle. */
export async function createInvoiceDocumentUrl(
  objectPath: string,
  expiresInSeconds: number,
): Promise<string> {
  const supabase = createServiceSupabaseClient()
  const { data, error } = await supabase.storage
    .from('invoice_documents')
    .createSignedUrl(objectPath, expiresInSeconds)
  if (error || !data?.signedUrl)
    throw new Error(`invoice_document_url_failed:${error?.message ?? 'unknown'}`)
  return data.signedUrl
}
