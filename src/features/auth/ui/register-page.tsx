import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FieldDescription,
  FieldLabel,
  FormFeedback,
  Input,
  useFormFeedback,
} from '@doscientos/ui'
import { Link } from '@tanstack/react-router'
import { ArrowRight, Check, Sparkles, Utensils } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { register } from '../application/registration'
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../domain/password-policy'
import { PasswordRequirementsIndicator } from './password-requirements-indicator'

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
        const messages = {
          email_invalid:
            'Ese correo no es válido o el proveedor no lo acepta. Revisa que esté bien escrito.',
          email_exists:
            'Ya existe una cuenta con ese correo. Inicia sesión o recupera la contraseña.',
          password_weak: 'La contraseña no cumple los requisitos. Usa al menos 12 caracteres.',
          rate_limited: 'Has hecho demasiados intentos. Espera unos minutos y vuelve a probar.',
          unavailable:
            'El servicio de registro no está disponible ahora. Inténtalo de nuevo en unos minutos.',
        } as const
        feedback.setError(messages[result.errorCode])
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
    <main className="st-auth-shell st-auth-shell--orange st-register-shell">
      <span aria-hidden="true" className="st-auth-orb st-auth-orb--lime" />
      <span aria-hidden="true" className="st-auth-orb st-auth-orb--mint" />
      <section className="st-register-layout">
        <aside className="st-register-intro flex-col justify-between p-8 lg:p-10">
          <div>
            <span className="st-brand-mark bg-white/10 text-white shadow-none">
              <Utensils className="size-5" />
            </span>
            <p className="mt-8 text-sm font-medium text-orange-100">Tu restaurante, en orden</p>
            <h1 className="mt-3 max-w-md text-4xl leading-[0.96] tracking-[-0.055em] xl:text-5xl">
              Empieza una operativa más tranquila.
            </h1>
            <p className="mt-5 max-w-sm text-sm leading-6 text-white/80">
              Reservas, sala y equipo en un solo sitio para que cada servicio fluya mejor.
            </p>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-semibold text-orange-100/80">Lo tendrás listo paso a paso</p>
            <div className="grid gap-2 text-sm text-white/90">
              {[
                ['01', 'Tu espacio', 'Nombre, datos y preferencias'],
                ['02', 'Tu sala', 'Mesas, reservas y turnos'],
                ['03', 'Tu equipo', 'Roles y permisos para trabajar'],
              ].map(([number, title, description]) => (
                <div
                  className="flex items-center gap-3 rounded-xl bg-white/10 px-3 py-2.5"
                  key={number}
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-bold">
                    {number}
                  </span>
                  <span>
                    <strong className="block font-semibold">{title}</strong>
                    <span className="text-xs text-white/70">{description}</span>
                  </span>
                  <Check className="ml-auto size-4 text-orange-100/70" />
                </div>
              ))}
            </div>
          </div>
          <p className="flex items-center gap-3 text-sm leading-6 text-white/75">
            <Sparkles className="size-4 shrink-0 text-orange-100" />
            Configúralo en pocos minutos y prepara tu siguiente servicio.
          </p>
        </aside>
        <Card className="st-auth-card w-full max-w-120 justify-self-center border-0">
          <CardHeader>
            <div className="mb-3 flex items-center gap-2">
              <img alt="" aria-hidden="true" className="size-9 rounded-xl" src="/icon.svg" />
              <span className="text-sm font-semibold tracking-[-0.02em]">SobreTaula</span>
            </div>
            <p className="text-primary mb-2 text-sm font-semibold xl:hidden">
              Empieza una operativa más tranquila.
            </p>
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
                  placeholder="Ej. Marta García"
                  required
                  value={displayName}
                />
                <FieldDescription>La persona responsable de este espacio.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="register-email">Correo profesional</FieldLabel>
                <Input
                  autoComplete="email"
                  id="register-email"
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="marta@casamuntaner.com"
                  required
                  type="email"
                  value={email}
                />
                <FieldDescription>Usaremos este correo para entrar y ayudarte.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="register-password">Contraseña</FieldLabel>
                <div className="relative">
                  <Input
                    autoComplete="new-password"
                    className="pr-10"
                    id="register-password"
                    maxLength={PASSWORD_MAX_LENGTH}
                    minLength={PASSWORD_MIN_LENGTH}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Crea una contraseña segura"
                    required
                    type="password"
                    value={password}
                  />
                  <PasswordRequirementsIndicator password={password} />
                </div>
                <FieldDescription>
                  Mínimo 12 caracteres. No la compartas con el equipo.
                </FieldDescription>
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
      <footer className="z-[1] flex flex-wrap justify-center gap-x-4 gap-y-3 text-xs text-[#5f4036]">
        <span>© {new Date().getFullYear()} SobreTaula</span>
        <Link
          className="font-medium text-[#7e3025] underline underline-offset-[0.2em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7e3025]"
          to="/legal/privacidad"
        >
          Privacidad
        </Link>
        <Link
          className="font-medium text-[#7e3025] underline underline-offset-[0.2em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7e3025]"
          to="/legal/condiciones-saas"
        >
          Condiciones
        </Link>
      </footer>
    </main>
  )
}
