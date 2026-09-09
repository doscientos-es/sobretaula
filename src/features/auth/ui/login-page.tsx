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
import { useState, type FormEvent } from 'react'

import { login } from '../application/authentication'
import { isSafeInternalRedirect } from '../domain/auth'

export function LoginPage({ redirectTo }: { redirectTo?: string }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const feedback = useFormFeedback()

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    feedback.setPending()

    try {
      const result = await login({ data: { email, password } })
      if (!result.ok) {
        feedback.setError('El correo o la contraseña no son correctos.')
        return
      }

      // `/` resolves the authenticated principal to platform or tenant context.
      window.location.assign(isSafeInternalRedirect(redirectTo) ? redirectTo : '/')
    } catch {
      feedback.setError('No se ha podido iniciar sesión. Inténtalo de nuevo.')
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Accede a SobreTaula</CardTitle>
          <CardDescription>Usa las credenciales de tu cuenta profesional.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={(event) => void submit(event)}>
            <Field>
              <FieldLabel htmlFor="email">Correo electrónico</FieldLabel>
              <Input
                autoComplete="email"
                id="email"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Contraseña</FieldLabel>
              <Input
                autoComplete="current-password"
                id="password"
                minLength={1}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </Field>
            <FormFeedback pendingLabel="Accediendo…" state={feedback.state} />
            <Button className="w-full" disabled={feedback.pending} type="submit">
              Entrar
            </Button>
          </form>
          <p className="text-muted-foreground mt-5 text-center text-sm">
            ¿Es tu primer restaurante?{' '}
            <Link className="text-primary underline" to="/registro">Crea tu cuenta</Link>.
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
