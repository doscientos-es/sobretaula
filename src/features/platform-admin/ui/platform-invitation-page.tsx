import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FormFeedback,
  useFormFeedback,
} from '@doscientos/ui'

import { acceptPlatformInvitation } from '../application/platform-operators'

/** Completes a one-use invitation after the invited email has authenticated. */
export function PlatformInvitationPage({ token }: { token: string }) {
  const feedback = useFormFeedback()

  async function accept() {
    feedback.setPending()
    try {
      await acceptPlatformInvitation({ data: { token } })
      window.location.assign('/admin')
    } catch {
      feedback.setError(
        'La invitación no está disponible, ha caducado o corresponde a otro correo.',
      )
    }
  }

  return (
    <main className="st-auth-shell">
      <Card className="st-auth-card relative w-full max-w-md">
        <CardHeader>
          <CardTitle>Acceso a la plataforma</CardTitle>
          <CardDescription>
            Confirma que quieres aceptar el acceso global concedido a tu cuenta.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <FormFeedback pendingLabel="Activando acceso…" state={feedback.state} />
          <Button
            className="w-full"
            disabled={feedback.pending}
            onClick={() => void accept()}
            size="lg"
          >
            Aceptar acceso de plataforma
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
