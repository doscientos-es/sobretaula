import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, FormFeedback, useFormFeedback } from '@doscientos/ui'

import { acceptTenantInvitation } from '../application/team'

/** Completes a signed-in worker's invitation from the one-use link in their email. */
export function TenantInvitationPage({ token }: { token: string }) {
  const feedback = useFormFeedback()

  async function accept() {
    feedback.setPending()
    try {
      const { slug } = await acceptTenantInvitation({ data: { token } })
      window.location.assign(`/t/${slug}`)
    } catch {
      feedback.setError('Esta invitación no está disponible, ha caducado o corresponde a otro correo.')
    }
  }

  return <main className="flex min-h-svh items-center justify-center p-6"><Card className="w-full max-w-md"><CardHeader><CardTitle>Únete al equipo</CardTitle><CardDescription>Confirma que quieres acceder a este restaurante con tu cuenta.</CardDescription></CardHeader><CardContent className="space-y-5"><FormFeedback pendingLabel="Uniéndote al equipo…" state={feedback.state} /><Button className="w-full" disabled={feedback.pending} onClick={() => void accept()}>Aceptar invitación</Button></CardContent></Card></main>
}