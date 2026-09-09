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
import { UsersRound, Utensils } from 'lucide-react'

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
    <main className="st-auth-shell">
      <span aria-hidden="true" className="st-auth-orb st-auth-orb--lime" />
      <span aria-hidden="true" className="st-auth-orb st-auth-orb--mint" />
      <Card className="st-auth-card relative w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="st-brand-mark">
              <Utensils className="size-5" />
            </span>
            <UsersRound className="text-primary size-5" />
          </div>
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
            Aceptar invitación
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
