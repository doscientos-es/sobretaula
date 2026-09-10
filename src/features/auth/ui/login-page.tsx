import {
  Button,
  CardDescription,
  Checkbox,
  Field,
  FieldDescription,
  FieldLabel,
  FormFeedback,
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  useFormFeedback,
} from '@doscientos/ui'
import { Link } from '@tanstack/react-router'
import { ArrowRight, Eye, EyeOff, Mail, Utensils } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'

const abstractRestaurant = '/abstract-restaurant-image.avif'

import { login } from '../application/authentication'
import { isSafeInternalRedirect } from '../domain/auth'

export function LoginPage({ redirectTo }: { redirectTo?: string }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isPasswordVisible, setPasswordVisible] = useState(false)
  const [rememberSession, setRememberSession] = useState(false)
  const feedback = useFormFeedback()
  const emailInput = useRef<HTMLInputElement>(null)
  const isSubmitting = useRef(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting.current) return

    isSubmitting.current = true
    feedback.setPending()

    try {
      const result = await login({ data: { email: email.trim(), password, rememberSession } })
      if (!result.ok) {
        feedback.setError('El correo o la contraseña no son correctos.')
        isSubmitting.current = false
        emailInput.current?.focus()
        return
      }

      // `/` resolves the authenticated principal to platform or tenant context.
      window.location.assign(isSafeInternalRedirect(redirectTo) ? redirectTo : '/')
    } catch {
      feedback.setError('No se ha podido iniciar sesión. Inténtalo de nuevo.')
      isSubmitting.current = false
      emailInput.current?.focus()
    }
  }

  return (
    <main className="st-login-page">
      <section className="st-login-form-panel">
        <div className="st-login-form-content">
          <Link aria-label="SobreTaula, inicio" className="st-login-brand" to="/">
            <span className="st-brand-mark">
              <Utensils aria-hidden="true" className="size-5" />
            </span>
            <span>SobreTaula</span>
          </Link>
          <div className="my-auto w-full max-w-md py-14 sm:py-20">
            <h1 id="login-title" className="text-4xl font-semibold tracking-[-0.055em]">
              Inicia sesión
            </h1>
            <CardDescription id="login-description" className="mt-2.5 text-base leading-7">
              Accede a tu espacio de trabajo.
            </CardDescription>
            <form
              aria-busy={feedback.pending}
              aria-describedby="login-description login-feedback"
              aria-labelledby="login-title"
              className="mt-10 space-y-5"
              onSubmit={(event) => void submit(event)}
            >
              <Field>
                <FieldLabel htmlFor="email">Correo electrónico</FieldLabel>
                <InputGroup>
                  <InputGroupAddon align="inline-start">
                    <Mail aria-hidden="true" className="size-4" />
                  </InputGroupAddon>
                  <InputGroupInput
                    autoCapitalize="none"
                    autoComplete="username"
                    className="h-12 text-base"
                    id="email"
                    inputMode="email"
                    maxLength={254}
                    name="email"
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="nombre@restaurante.com"
                    ref={emailInput}
                    required
                    spellCheck={false}
                    type="email"
                    value={email}
                  />
                </InputGroup>
                <FieldDescription>El correo con el que creaste tu cuenta.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Contraseña</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    autoComplete="current-password"
                    className="h-12 text-base"
                    id="password"
                    maxLength={256}
                    minLength={1}
                    name="password"
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    type={isPasswordVisible ? 'text' : 'password'}
                    value={password}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      aria-label={isPasswordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      aria-pressed={isPasswordVisible}
                      onPress={() => setPasswordVisible((visible) => !visible)}
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    >
                      {isPasswordVisible ? (
                        <EyeOff aria-hidden="true" />
                      ) : (
                        <Eye aria-hidden="true" />
                      )}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
              </Field>
              <Checkbox isSelected={rememberSession} onChange={setRememberSession}>
                Recordar sesión
              </Checkbox>
              <div id="login-feedback">
                <FormFeedback
                  className="w-full"
                  pendingLabel="Comprobando tus credenciales…"
                  state={feedback.state}
                />
              </div>
              <Button className="h-12 w-full text-base" disabled={feedback.pending} type="submit">
                Iniciar sesión <ArrowRight className="size-4" />
              </Button>
            </form>
            <Button
              aria-label="Continuar con Google — Próximamente"
              className="relative mt-3 h-12 w-full text-base"
              disabled
              type="button"
              variant="outline"
            >
              <img
                alt=""
                aria-hidden="true"
                className="size-5"
                src="https://developers.google.com/identity/sign-in/g-normal.png"
              />
              Continuar con Google
              <span className="bg-muted text-muted-foreground absolute -top-2 right-3 rounded-full px-1.5 py-0.5 text-[0.625rem] font-semibold">
                Próximamente
              </span>
            </Button>
            <p className="text-muted-foreground mt-7 text-center text-sm leading-6">
              ¿Es tu primer restaurante?{' '}
              <Link
                className="text-primary font-medium underline underline-offset-4"
                to="/registro"
              >
                Crea tu cuenta
              </Link>
              .
            </p>
          </div>
          <p className="text-muted-foreground text-xs">© {new Date().getFullYear()} SobreTaula</p>
        </div>
      </section>
      <aside aria-label="Experiencias de clientes" className="st-login-visual">
        <img alt="" aria-hidden="true" className="st-login-visual-image" src={abstractRestaurant} />
        <div className="st-login-visual-shade" />
        <div aria-live="polite" className="st-login-reviews">
          <article className="st-login-review st-login-review--one">
            <p>“Hemos ganado tiempo en cada turno y el equipo sabe qué hacer en todo momento.”</p>
            <footer>
              <strong>Clara Vidal</strong>
              <span>· Restaurante La Pineda</span>
            </footer>
          </article>
          <article className="st-login-review st-login-review--two">
            <p>“Las reservas, las mesas y las cuentas están por fin en el mismo sitio.”</p>
            <footer>
              <strong>Marc Ferrer</strong>
              <span>· Casa Aurora</span>
            </footer>
          </article>
          <article className="st-login-review st-login-review--three">
            <p>
              “Es más fácil preparar el servicio y cuidar de cada cliente desde que usamos
              SobreTaula.”
            </p>
            <footer>
              <strong>Elena Soler</strong>
              <span>· La Mesa del Mar</span>
            </footer>
          </article>
        </div>
      </aside>
    </main>
  )
}
