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
import { ArrowRight, Sparkles, Utensils } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { register } from '../application/registration'

/** Starts self-service onboarding by creating the restaurant owner's identity. */
export function RegisterPage() {
  const feedback = useFormFeedback()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    feedback.setPending()
    try {
      const result = await register({ data: { displayName, email, password } })
      if (!result.ok) {
        feedback.setError(
          'No se ha podido crear la cuenta. Prueba con otro correo o inicia sesión.',
        )
        return
      }
      if (result.requiresEmailConfirmation) {
        feedback.setSuccess(
          'Revisa tu correo y confirma la cuenta. Después inicia sesión para continuar.',
        )
        return
      }
      window.location.assign('/onboarding')
    } catch {
      feedback.setError('No se ha podido crear la cuenta. Inténtalo de nuevo.')
    }
  }

  return (
    <main className="st-auth-shell">
      <span aria-hidden="true" className="st-auth-orb st-auth-orb--lime" />
      <span aria-hidden="true" className="st-auth-orb st-auth-orb--mint" />
      <section className="relative grid w-full max-w-5xl overflow-hidden rounded-[1.5rem] lg:grid-cols-[1.12fr_0.88fr]">
        <div className="st-auth-intro hidden flex-col justify-between p-10 lg:flex">
          <div>
            <span className="st-brand-mark bg-white/10 text-white shadow-none">
              <Utensils className="size-5" />
            </span>
            <p className="mt-8 text-sm font-medium text-lime-100">Tu restaurante, en orden</p>
            <h1 className="mt-3 max-w-md text-5xl leading-[0.96] tracking-[-0.055em]">
              Empieza una operativa más tranquila.
            </h1>
          </div>
          <p className="flex max-w-sm items-center gap-3 text-sm leading-6 text-emerald-50/75">
            <Sparkles className="size-4 shrink-0 text-lime-200" />
            Crea tu espacio y prepara la sala para el siguiente servicio.
          </p>
        </div>
        <Card className="st-auth-card w-full rounded-[1.5rem] border-0 lg:rounded-l-none">
          <CardHeader>
            <div className="st-brand-mark mb-3 lg:hidden">
              <Utensils className="size-5" />
            </div>
            <CardTitle>Crea tu restaurante</CardTitle>
            <CardDescription>
              Empieza con tu cuenta de propietario; completarás los datos después.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={(event) => void submit(event)}>
              <Field>
                <FieldLabel htmlFor="register-name">Tu nombre</FieldLabel>
                <Input
                  autoComplete="name"
                  id="register-name"
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  value={displayName}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="register-email">Correo profesional</FieldLabel>
                <Input
                  autoComplete="email"
                  id="register-email"
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  type="email"
                  value={email}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="register-password">Contraseña</FieldLabel>
                <Input
                  autoComplete="new-password"
                  id="register-password"
                  minLength={12}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  type="password"
                  value={password}
                />
              </Field>
              <FormFeedback pendingLabel="Creando cuenta…" state={feedback.state} />
              <Button className="w-full" disabled={feedback.pending} size="lg" type="submit">
                Continuar <ArrowRight className="size-4" />
              </Button>
            </form>
            <p className="text-muted-foreground mt-5 text-center text-sm">
              ¿Ya tienes cuenta?{' '}
              <Link className="text-primary underline" to="/login">
                Inicia sesión
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
