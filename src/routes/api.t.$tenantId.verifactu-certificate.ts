import { createFileRoute } from '@tanstack/react-router'

import { getAuthenticatedPrincipal } from '@/features/auth/infrastructure/server/auth-middleware'
import {
  storeVerifactuCertificate,
  VerifactuCertificateError,
} from '@/features/invoices/application/verifactu-certificate.server'

const MAX_CERTIFICATE_BYTES = 2 * 1024 * 1024

function isSameOrigin(request: Request): boolean {
  return request.headers.get('origin') === new URL(request.url).origin
}

export const Route = createFileRoute('/api/t/$tenantId/verifactu-certificate')({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        if (!isSameOrigin(request)) return new Response('Forbidden', { status: 403 })

        try {
          const principal = await getAuthenticatedPrincipal()
          const form = await request.formData()
          const certificate = form.get('certificate')
          const password = form.get('password')
          if (
            !(certificate instanceof File) ||
            typeof password !== 'string' ||
            password.length > 256 ||
            certificate.size === 0 ||
            certificate.size > MAX_CERTIFICATE_BYTES
          ) {
            return new Response('Invalid certificate upload', { status: 400 })
          }

          await storeVerifactuCertificate({
            accessToken: principal.accessToken,
            bytes: Buffer.from(await certificate.arrayBuffer()),
            password,
            tenantId: params.tenantId,
            userId: principal.userId,
          })
          return Response.json({ ok: true })
        } catch (error) {
          if (error instanceof Response) return error
          if (error instanceof VerifactuCertificateError) {
            const status =
              error.code === 'forbidden' ? 403 : error.code === 'upload_failed' ? 500 : 422
            return new Response(error.code, { status })
          }
          return new Response('Certificate upload failed', { status: 500 })
        }
      },
    },
  },
})
