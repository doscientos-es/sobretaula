import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FieldLabel,
  FormFeedback,
  Input,
  useFormFeedback,
} from '@doscientos/ui'
import { CheckCircle2, Utensils } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'

import { createBrowserSupabaseClient } from '@/shared/lib/supabase/client'

import { completeExternalAuthSession } from '../application/registration'

/** Exchanges Supabase's email-link session for the server session after an invited user sets a password. */
export function ActivateAccountPage({
  invitationPath,
  invitationToken,
}: {
  invitationPath: '/admin/invitacion' | '/invitacion'
  invitationToken: string
}) {
  const feedback = useFormFeedback()
  const [password, setPassword] = useState('')
  const [sessionReady, setSessionReady] = useState(false)
  const [requiresLogin, setRequiresLogin] = useState(false)

  useEffect(() => {
    void createBrowserSupabaseClient()
      .auth.getSession()
      .then(({ data }) => setSessionReady(Boolean(data.session)))
      .catch(() => setSessionReady(false))
  }, [])

  function requestLoginToContinue() {
    setRequiresLogin(true)
    feedback.setError('La contraseña se ha guardado. Inicia sesión para terminar de aceptar la invitación.')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    feedback.setPending()
    let passwordSaved = false
    try {
      const client = createBrowserSupabaseClient()
      const { error: passwordError } = await client.auth.updateUser({ password })
      if (passwordError) throw passwordError
      passwordSaved = true

      const { data: userData, error: userError } = await client.auth.getUser()
      if (userError || !userData.user.email) throw new Error('activation_user_missing')
      const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
        email: userData.user.email,
        password,
      })
      if (signInError || !signInData.session) throw new Error('activation_reauthentication_failed')
      const result = await completeExternalAuthSession({
        data: {
          accessToken: signInData.session.access_token,
          refreshToken: signInData.session.refresh_token,
        },
      })
      if (!result.ok) {
        requestLoginToContinue()
        return
      }
      window.location.assign(`${invitationPath}?token=${encodeURIComponent(invitationToken)}`)
    } catch {
      if (passwordSaved) {
        requestLoginToContinue()
        return
      }
      feedback.setError('No se ha podido activar la cuenta. Abre de nuevo el enlace del correo.')
    }
  }

  return (
    <main className="st-auth-shell">
      <span aria-hidden="true" className="st-auth-orb st-auth-orb--lime" />
      <span aria-hidden="true" className="st-auth-orb st-auth-orb--mint" />
      <Card className="st-auth-card relative w-full max-w-md">
        <CardHeader>
          <div className="st-brand-mark mb-3">
            <Utensils className="size-5" />
          </div>
          <CardTitle>Activa tu cuenta</CardTitle>
          <CardDescription>Elige una contraseña para entrar en SobreTaula.</CardDescription>
        </CardHeader>
        <CardContent>
          {!sessionReady ? (
            <p className="text-muted-foreground flex items-start gap-3 text-sm leading-6">
              <CheckCircle2 className="text-success mt-0.5 size-4 shrink-0" />
              Estamos comprobando el enlace seguro. Si no avanza, solicita una nueva invitación.
            </p>
          ) : (
            <form className="space-y-5" onSubmit={(event) => void submit(event)}>
              <Field>
                <FieldLabel htmlFor="activation-password">Nueva contraseña</FieldLabel>
                <Input
                  autoComplete="new-password"
                  id="activation-password"
                  minLength={12}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="password"
                  value={password}
                />
              </Field>
              <FormFeedback pendingLabel="Activando cuenta…" state={feedback.state} />
              <Button className="w-full" disabled={feedback.pending} size="lg" type="submit">
                Activar y unirme al equipo
              </Button>
              {requiresLogin && (
                <Button
                  className="w-full"
                  onClick={() => {
                    const destination = `${invitationPath}?token=${encodeURIComponent(invitationToken)}`
                    window.location.assign(`/login?redirect=${encodeURIComponent(destination)}`)
                  }}
                  type="button"
                  variant="outline"
                >
                  Iniciar sesión para continuar
                </Button>
              )}
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
