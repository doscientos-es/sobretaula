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
import { useEffect, useState, type FormEvent } from 'react'

import { createBrowserSupabaseClient } from '@/shared/lib/supabase/client'

import { completeExternalAuthSession } from '../application/registration'

/** Exchanges Supabase's email-link session for the server session after the worker sets a password. */
export function ActivateAccountPage({ invitationToken }: { invitationToken: string }) {
  const feedback = useFormFeedback()
  const [password, setPassword] = useState('')
  const [sessionReady, setSessionReady] = useState(false)

  useEffect(() => {
    void createBrowserSupabaseClient()
      .auth.getSession()
      .then(({ data }) => setSessionReady(Boolean(data.session)))
      .catch(() => setSessionReady(false))
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    feedback.setPending()
    try {
      const client = createBrowserSupabaseClient()
      const { error: passwordError } = await client.auth.updateUser({ password })
      if (passwordError) throw passwordError
      const { data } = await client.auth.getSession()
      if (!data.session) throw new Error('activation_session_missing')
      const result = await completeExternalAuthSession({
        data: { accessToken: data.session.access_token, refreshToken: data.session.refresh_token },
      })
      if (!result.ok) throw new Error('activation_session_rejected')
      window.location.assign(`/invitacion?token=${encodeURIComponent(invitationToken)}`)
    } catch {
      feedback.setError('No se ha podido activar la cuenta. Abre de nuevo el enlace del correo.')
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Activa tu cuenta</CardTitle>
          <CardDescription>Elige una contraseña para entrar en SobreTaula.</CardDescription>
        </CardHeader>
        <CardContent>
          {!sessionReady ? (
            <p className="text-muted-foreground text-sm">
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
              <Button className="w-full" disabled={feedback.pending} type="submit">
                Activar y unirme al equipo
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
