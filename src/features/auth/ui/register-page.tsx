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
        feedback.setError('No se ha podido crear la cuenta. Prueba con otro correo o inicia sesión.')
        return
      }
      if (result.requiresEmailConfirmation) {
        feedback.setSuccess('Revisa tu correo y confirma la cuenta. Después inicia sesión para continuar.')
        return
      }
      window.location.assign('/onboarding')
    } catch {
      feedback.setError('No se ha podido crear la cuenta. Inténtalo de nuevo.')
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Crea tu restaurante</CardTitle>
          <CardDescription>Empieza con tu cuenta de propietario; completarás los datos después.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={(event) => void submit(event)}>
            <Field>
              <FieldLabel htmlFor="register-name">Tu nombre</FieldLabel>
              <Input autoComplete="name" id="register-name" onChange={(e) => setDisplayName(e.target.value)} required value={displayName} />
            </Field>
            <Field>
              <FieldLabel htmlFor="register-email">Correo profesional</FieldLabel>
              <Input autoComplete="email" id="register-email" onChange={(e) => setEmail(e.target.value)} required type="email" value={email} />
            </Field>
            <Field>
              <FieldLabel htmlFor="register-password">Contraseña</FieldLabel>
              <Input autoComplete="new-password" id="register-password" minLength={12} onChange={(e) => setPassword(e.target.value)} required type="password" value={password} />
            </Field>
            <FormFeedback pendingLabel="Creando cuenta…" state={feedback.state} />
            <Button className="w-full" disabled={feedback.pending} type="submit">Continuar</Button>
          </form>
          <p className="text-muted-foreground mt-5 text-center text-sm">
            ¿Ya tienes cuenta? <Link className="text-primary underline" to="/login">Inicia sesión</Link>.
          </p>
        </CardContent>
      </Card>
    </main>
  )
}