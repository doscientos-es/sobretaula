import { createHash } from 'node:crypto'

import forge from 'node-forge'

import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

import { normalizeNif } from '../domain/invoice'

const MAX_CERTIFICATE_BYTES = 2 * 1024 * 1024

export class VerifactuCertificateError extends Error {
  constructor(
    readonly code:
      | 'certificate_expired'
      | 'certificate_invalid'
      | 'certificate_nif_mismatch'
      | 'fiscal_settings_missing'
      | 'forbidden'
      | 'upload_failed',
  ) {
    super(code)
  }
}

export interface ValidatedVerifactuCertificate {
  expiresAt: string
  fingerprint: string
  subject: string
}

/** Opens a PKCS#12 only in memory and derives the metadata safe to display. */
export function validateVerifactuCertificate({
  bytes,
  issuerNif,
  password,
}: {
  bytes: Buffer
  issuerNif: string
  password: string
}): ValidatedVerifactuCertificate {
  if (bytes.length === 0 || bytes.length > MAX_CERTIFICATE_BYTES) {
    throw new VerifactuCertificateError('certificate_invalid')
  }

  try {
    const der = forge.util.createBuffer(bytes.toString('latin1'))
    const pfx = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(der), false, password)
    const keyBagType = forge.pki.oids.pkcs8ShroudedKeyBag
    const certificateBagType = forge.pki.oids.certBag
    if (!keyBagType || !certificateBagType)
      throw new VerifactuCertificateError('certificate_invalid')
    const keyBags = pfx.getBags({ bagType: keyBagType })[keyBagType] ?? []
    const certificateBags = pfx.getBags({ bagType: certificateBagType })[certificateBagType] ?? []
    const key = keyBags.map((bag: forge.pkcs12.Bag) => bag.key).find(Boolean)
    const certificates = certificateBags
      .map((bag: forge.pkcs12.Bag) => bag.cert)
      .filter((certificate): certificate is forge.pki.Certificate => Boolean(certificate))
    const certificate = certificates.find(
      (candidate: forge.pki.Certificate) =>
        candidate?.publicKey.n.compareTo(key?.n) === 0 &&
        candidate.publicKey.e.compareTo(key?.e) === 0,
    )
    if (!key || !certificate) throw new VerifactuCertificateError('certificate_invalid')
    if (certificate.validity.notAfter.getTime() <= Date.now()) {
      throw new VerifactuCertificateError('certificate_expired')
    }

    const attributes = certificate.subject.attributes
    const values = attributes.map((attribute: forge.pki.CertificateField) =>
      String(attribute.value),
    )
    const normalizedIssuerNif = normalizeNif(issuerNif)
    if (!values.some((value: string) => normalizeNif(value).includes(normalizedIssuerNif))) {
      throw new VerifactuCertificateError('certificate_nif_mismatch')
    }

    const commonName = attributes.find(
      (attribute: forge.pki.CertificateField) => attribute.name === 'commonName',
    )?.value
    const subject = String(commonName ?? values.join(', '))
      .trim()
      .slice(0, 400)
    if (!subject) throw new VerifactuCertificateError('certificate_invalid')
    const certificateDer = forge.asn1.toDer(forge.pki.certificateToAsn1(certificate)).getBytes()
    return {
      expiresAt: certificate.validity.notAfter.toISOString(),
      fingerprint: createHash('sha256').update(certificateDer, 'latin1').digest('hex'),
      subject,
    }
  } catch (error) {
    if (error instanceof VerifactuCertificateError) throw error
    throw new VerifactuCertificateError('certificate_invalid')
  }
}

/** Validates and atomically stores a tenant owner's certificate in Supabase Vault. */
export async function storeVerifactuCertificate({
  accessToken,
  bytes,
  password,
  tenantId,
  userId,
}: {
  accessToken: string
  bytes: Buffer
  password: string
  tenantId: string
  userId: string
}): Promise<ValidatedVerifactuCertificate> {
  const supabase = createRequestSupabaseClient(accessToken)
  const { data: membership, error: membershipError } = await supabase
    .from('memberships')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()
  if (membershipError || membership?.role !== 'owner')
    throw new VerifactuCertificateError('forbidden')

  const { data: settings, error: settingsError } = await supabase
    .from('tenant_fiscal_settings')
    .select('issuer_nif')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (settingsError) throw new VerifactuCertificateError('upload_failed')
  if (!settings) throw new VerifactuCertificateError('fiscal_settings_missing')

  const certificate = validateVerifactuCertificate({
    bytes,
    issuerNif: settings.issuer_nif as string,
    password,
  })
  const { error } = await supabase.rpc('replace_tenant_verifactu_certificate', {
    p_tenant_id: tenantId,
    p_certificate_base64: bytes.toString('base64'),
    p_expires_at: certificate.expiresAt,
    p_fingerprint: certificate.fingerprint,
    p_subject: certificate.subject,
  })
  if (error) throw new VerifactuCertificateError('upload_failed')
  return certificate
}
