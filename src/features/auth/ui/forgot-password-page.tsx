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
import { Link } from '@tanstack/react-router'
import { ArrowRight, KeyRound, MailCheck, Utensils } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { isAuthEmailRateLimited } from '@/shared/lib/supabase/auth-email-rate-limit'

import { requestPasswordReset } from '../application/authentication'

const CONFIRMATION_MESSAGE =
  'Si existe una cuenta con ese correo, te hemos enviado un enlace para restablecer la contraseña.'

/** Requests a Supabase recovery email without ever revealing whether the account exists. */
export function ForgotPasswordPage() {
  const feedback = useFormFeedback()
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (feedback.pending) return
    feedback.setPending()

    try {
      await requestPasswordReset({
        data: {
          email: email.trim(),
          redirectTo: new URL('/restablecer-contrasena', window.location.origin).toString(),
        },
      })
      setSubmitted(true)
      feedback.setSuccess(CONFIRMATION_MESSAGE)
    } catch (error) {
      if (isAuthEmailRateLimited(error)) {
        feedback.setError(
          'Hemos enviado demasiados enlaces. Espera unos minutos e inténtalo de nuevo.',
        )
        return
      }
      feedback.setError('No se ha podido enviar el enlace. Inténtalo de nuevo más tarde.')
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
            {submitted ? (
              <MailCheck aria-hidden="true" className="size-5" />
            ) : (
              <KeyRound aria-hidden="true" className="size-5" />
            )}
          </div>
          <p className="st-auth-action-eyebrow">Acceso a tu cuenta</p>
          <CardTitle>{submitted ? 'Revisa tu correo' : 'Recupera tu contraseña'}</CardTitle>
          <CardDescription>
            {submitted
              ? 'Te hemos indicado cómo continuar de forma segura.'
              : 'Escribe tu correo y te enviaremos un enlace para restablecerla.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="space-y-5">
              <FormFeedback state={feedback.state} />
              <Button
                className="w-full"
                onClick={() => window.location.assign('/login')}
                size="lg"
                type="button"
                variant="outline"
              >
                Volver a iniciar sesión <ArrowRight className="size-4" />
              </Button>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={(event) => void submit(event)}>
              <Field>
                <FieldLabel htmlFor="forgot-password-email">Correo electrónico</FieldLabel>
                <Input
                  autoComplete="email"
                  id="forgot-password-email"
                  maxLength={254}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="nombre@restaurante.com"
                  required
                  type="email"
                  value={email}
                />
              </Field>
              <FormFeedback pendingLabel="Enviando enlace…" state={feedback.state} />
              <Button className="w-full" disabled={feedback.pending} size="lg" type="submit">
                Enviar enlace <ArrowRight className="size-4" />
              </Button>
              <p className="text-muted-foreground text-center text-sm leading-6">
                <Link className="text-primary font-medium underline underline-offset-4" to="/login">
                  Volver a iniciar sesión
                </Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
      <p className="st-auth-action-footer">© {new Date().getFullYear()} SobreTaula</p>
    </main>
  )
}
