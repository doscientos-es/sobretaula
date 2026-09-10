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
import { ArrowRight, Utensils } from 'lucide-react'
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
      await requestPasswordReset({ data: { email: email.trim() } })
      setSubmitted(true)
      feedback.setSuccess(CONFIRMATION_MESSAGE)
    } catch (error) {
      if (isAuthEmailRateLimited(error)) {
        feedback.setError(
          'Hemos enviado demasiados enlaces. Espera unos minutos e inténtalo de nuevo.',
        )
        return
      }
      // Delivery failures still show the generic message so the response never leaks account existence.
      setSubmitted(true)
      feedback.setSuccess(CONFIRMATION_MESSAGE)
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
          <CardTitle>¿Olvidaste tu contraseña?</CardTitle>
          <CardDescription>
            Escribe tu correo y te enviaremos un enlace para restablecerla.
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
                Volver a iniciar sesión
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
    </main>
  )
}
