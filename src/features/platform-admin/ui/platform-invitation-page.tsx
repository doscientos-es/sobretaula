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
import { ArrowRight, ShieldCheck, Utensils } from 'lucide-react'

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
    <main className="st-auth-action-shell st-auth-shell st-auth-shell--orange">
      <span aria-hidden="true" className="st-auth-orb st-auth-orb--lime" />
      <span aria-hidden="true" className="st-auth-orb st-auth-orb--mint" />
      <Card className="st-auth-action-card st-auth-card relative">
        <CardHeader>
          <div className="st-auth-action-brand">
            <span className="st-brand-mark size-9 rounded-xl">
              <Utensils aria-hidden="true" className="size-5" />
            </span>
            <span>SobreTaula</span>
          </div>
          <div className="st-auth-action-icon">
            <ShieldCheck aria-hidden="true" className="size-5" />
          </div>
          <p className="st-auth-action-eyebrow">Permiso global</p>
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
            Aceptar acceso de plataforma <ArrowRight className="size-4" />
          </Button>
        </CardContent>
      </Card>
      <p className="st-auth-action-footer">© {new Date().getFullYear()} SobreTaula</p>
    </main>
  )
}
