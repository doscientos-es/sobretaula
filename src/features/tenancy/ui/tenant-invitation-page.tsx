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
import { ArrowRight, UsersRound, Utensils } from 'lucide-react'

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
      feedback.setError(
        'Esta invitación no está disponible, ha caducado o corresponde a otro correo.',
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
            <UsersRound aria-hidden="true" className="size-5" />
          </div>
          <p className="st-auth-action-eyebrow">Invitación al equipo</p>
          <CardTitle>Únete al equipo</CardTitle>
          <CardDescription>
            Confirma que quieres acceder a este restaurante con tu cuenta.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <FormFeedback pendingLabel="Uniéndote al equipo…" state={feedback.state} />
          <Button
            className="w-full"
            disabled={feedback.pending}
            onClick={() => void accept()}
            size="lg"
          >
            Aceptar invitación <ArrowRight className="size-4" />
          </Button>
        </CardContent>
      </Card>
      <p className="st-auth-action-footer">© {new Date().getFullYear()} SobreTaula</p>
    </main>
  )
}
