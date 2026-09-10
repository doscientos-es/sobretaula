import forge from 'node-forge'
import { describe, expect, it } from 'vitest'

import { validateVerifactuCertificate, VerifactuCertificateError } from './verifactu-certificate'

function createCertificate({ expiresAt, subject }: { expiresAt: Date; subject: string }): Buffer {
  const keys = forge.pki.rsa.generateKeyPair(512)
  const certificate = forge.pki.createCertificate()
  certificate.publicKey = keys.publicKey
  certificate.serialNumber = '01'
  certificate.validity.notBefore = new Date(Date.now() - 60_000)
  certificate.validity.notAfter = expiresAt
  certificate.setSubject([{ name: 'commonName', value: subject }])
  certificate.setIssuer([{ name: 'commonName', value: subject }])
  certificate.sign(keys.privateKey, forge.md.sha256.create())
  const asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, certificate, 'safe-password')
  return Buffer.from(forge.asn1.toDer(asn1).getBytes(), 'latin1')
}

describe('validateVerifactuCertificate', () => {
  it('accepts a non-expired PKCS#12 whose subject includes the issuer NIF', () => {
    const certificate = validateVerifactuCertificate({
      bytes: createCertificate({
        expiresAt: new Date(Date.now() + 86_400_000),
        subject: 'Restaurante B12345678',
      }),
      issuerNif: 'B12345678',
      password: 'safe-password',
    })

    expect(certificate.subject).toBe('Restaurante B12345678')
    expect(certificate.fingerprint).toMatch(/^[a-f0-9]{64}$/)
  })

  it('rejects certificates that belong to another fiscal issuer', () => {
    expect(() =>
      validateVerifactuCertificate({
        bytes: createCertificate({
          expiresAt: new Date(Date.now() + 86_400_000),
          subject: 'Restaurante A12345678',
        }),
        issuerNif: 'B12345678',
        password: 'safe-password',
      }),
    ).toThrow(new VerifactuCertificateError('certificate_nif_mismatch'))
  })

  it('rejects expired certificates', () => {
    expect(() =>
      validateVerifactuCertificate({
        bytes: createCertificate({
          expiresAt: new Date(Date.now() - 60_000),
          subject: 'Restaurante B12345678',
        }),
        issuerNif: 'B12345678',
        password: 'safe-password',
      }),
    ).toThrow(new VerifactuCertificateError('certificate_expired'))
  })
})
