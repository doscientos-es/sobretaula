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

/** Lets a user set a new password after Supabase validates a recovery email link. */
export function PasswordResetPage() {
  const feedback = useFormFeedback()
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [sessionReady, setSessionReady] = useState<boolean | null>(null)
  const [requiresLogin, setRequiresLogin] = useState(false)

  useEffect(() => {
    let mounted = true
    const client = createBrowserSupabaseClient()

    void client.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted) return
        setSessionReady(!error && Boolean(data.session))
        if (!error && data.session) {
          window.history.replaceState(
            null,
            '',
            `${window.location.pathname}${window.location.search}`,
          )
        }
      })
      .catch(() => {
        if (mounted) setSessionReady(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  function requestLoginToContinue() {
    setRequiresLogin(true)
    feedback.setError('La contraseña se ha guardado. Inicia sesión con ella para continuar.')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (password !== passwordConfirmation) {
      feedback.setError('Las contraseñas no coinciden.')
      return
    }

    feedback.setPending()
    let passwordSaved = false
    try {
      const client = createBrowserSupabaseClient()
      const { error: passwordError } = await client.auth.updateUser({ password })
      if (passwordError) throw passwordError
      passwordSaved = true

      const { data, error: sessionError } = await client.auth.getSession()
      if (sessionError || !data.session) throw new Error('password_reset_session_missing')
      const result = await completeExternalAuthSession({
        data: {
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
        },
      })
      if (!result.ok) {
        requestLoginToContinue()
        return
      }
      window.location.replace('/')
    } catch {
      if (passwordSaved) {
        requestLoginToContinue()
        return
      }
      feedback.setError('No se ha podido cambiar la contraseña. Solicita un enlace nuevo.')
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
          <CardTitle>Restablece tu contraseña</CardTitle>
          <CardDescription>Elige una contraseña nueva para volver a entrar.</CardDescription>
        </CardHeader>
        <CardContent>
          {sessionReady === null ? (
            <p className="text-muted-foreground flex items-start gap-3 text-sm leading-6">
              <CheckCircle2 className="text-success mt-0.5 size-4 shrink-0" />
              Estamos comprobando el enlace seguro.
            </p>
          ) : sessionReady ? (
            <form className="space-y-5" onSubmit={(event) => void submit(event)}>
              <Field>
                <FieldLabel htmlFor="reset-password">Nueva contraseña</FieldLabel>
                <Input
                  autoComplete="new-password"
                  id="reset-password"
                  maxLength={256}
                  minLength={12}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="password"
                  value={password}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="reset-password-confirmation">Repite la contraseña</FieldLabel>
                <Input
                  autoComplete="new-password"
                  id="reset-password-confirmation"
                  maxLength={256}
                  minLength={12}
                  onChange={(event) => setPasswordConfirmation(event.target.value)}
                  required
                  type="password"
                  value={passwordConfirmation}
                />
              </Field>
              <FormFeedback pendingLabel="Guardando contraseña…" state={feedback.state} />
              <Button className="w-full" disabled={feedback.pending} size="lg" type="submit">
                Guardar contraseña
              </Button>
              {requiresLogin && (
                <Button
                  className="w-full"
                  onClick={() => window.location.assign('/login?redirect=%2F')}
                  type="button"
                  variant="outline"
                >
                  Iniciar sesión
                </Button>
              )}
            </form>
          ) : (
            <div className="space-y-5">
              <p className="text-muted-foreground text-sm leading-6">
                Este enlace ya no es válido o ha caducado. Solicita uno nuevo para continuar.
              </p>
              <Button
                className="w-full"
                onClick={() => window.location.assign('/login')}
                size="lg"
                type="button"
                variant="outline"
              >
                Volver a iniciar sesión
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
