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
import { ArrowRight, CheckCircle2, KeyRound, ShieldCheck, Utensils } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'

import { createBrowserSupabaseClient } from '@/shared/lib/supabase/client'

import { completeExternalAuthSession } from '../application/registration'
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../domain/password-policy'
import { PasswordPolicyIndicator } from './password-policy-indicator'

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
            {sessionReady ? (
              <KeyRound aria-hidden="true" className="size-5" />
            ) : (
              <ShieldCheck aria-hidden="true" className="size-5" />
            )}
          </div>
          <p className="st-auth-action-eyebrow">Enlace seguro</p>
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
                <div className="relative">
                  <Input
                    autoComplete="new-password"
                    className="pr-10"
                    id="reset-password"
                    maxLength={PASSWORD_MAX_LENGTH}
                    minLength={PASSWORD_MIN_LENGTH}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Crea una contraseña segura"
                    required
                    type="password"
                    value={password}
                  />
                  <PasswordPolicyIndicator password={password} />
                </div>
              </Field>
              <Field>
                <FieldLabel htmlFor="reset-password-confirmation">Repite la contraseña</FieldLabel>
                <div className="relative">
                  <Input
                    autoComplete="new-password"
                    className="pr-10"
                    id="reset-password-confirmation"
                    maxLength={PASSWORD_MAX_LENGTH}
                    minLength={PASSWORD_MIN_LENGTH}
                    onChange={(event) => setPasswordConfirmation(event.target.value)}
                    placeholder="Repite la contraseña"
                    required
                    type="password"
                    value={passwordConfirmation}
                  />
                  <PasswordPolicyIndicator
                    confirmation={password}
                    password={passwordConfirmation}
                  />
                </div>
              </Field>
              <FormFeedback pendingLabel="Guardando contraseña…" state={feedback.state} />
              <Button className="w-full" disabled={feedback.pending} size="lg" type="submit">
                Guardar contraseña <ArrowRight className="size-4" />
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
      <p className="st-auth-action-footer">© {new Date().getFullYear()} SobreTaula</p>
    </main>
  )
}
