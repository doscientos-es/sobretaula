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
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
  useFormFeedback,
} from '@doscientos/ui'
import { useState, type FormEvent } from 'react'

import { useLoaderReload } from '@/shared/lib/router/use-loader-reload'

import {
  type PlatformOperator,
  type PlatformOperatorInvitation,
  invitePlatformOperator,
  revokePlatformOperator,
  updatePlatformOperatorRole,
} from '../application/platform-operators'
import {
  canManagePlatformOperator,
  isPlatformAdminRole,
  type PlatformAdminRole,
} from '../domain/platform-admin'

/** Lets owners safely invite, promote, demote or revoke other platform operators. */
export function PlatformOperatorsPage({
  currentUserId,
  invitations,
  operators,
}: {
  currentUserId: string
  invitations: readonly PlatformOperatorInvitation[]
  operators: readonly PlatformOperator[]
}) {
  const feedback = useFormFeedback()
  const reload = useLoaderReload()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<PlatformAdminRole>('platform_support')
  const ownerCount = operators.filter((operator) => operator.role === 'platform_owner').length

  async function run(action: () => Promise<unknown>, success: string) {
    feedback.setPending()
    try {
      await action()
      feedback.setSuccess(success)
      reload()
    } catch {
      feedback.setError('No se ha podido actualizar el acceso de plataforma. Inténtalo de nuevo.')
    }
  }

  function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void run(async () => {
      const result = await invitePlatformOperator({ data: { email, name, role } })
      setName('')
      setEmail('')
      return result
    }, 'Acceso concedido o invitación enviada por correo.')
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-5 sm:p-8">
      <PageHeader className="border-border/70 border-b pb-6">
        <div>
          <p className="st-page-kicker">Control de plataforma</p>
          <PageHeaderTitle>Equipo de plataforma</PageHeaderTitle>
          <PageHeaderDescription>
            Los superadministradores controlan tenants, facturación y operadores. El último owner
            nunca puede eliminarse.
          </PageHeaderDescription>
        </div>
      </PageHeader>
      <Card>
        <CardHeader>
          <CardTitle>Invitar operador</CardTitle>
          <CardDescription>
            Un superadministrador tiene control total. El soporte sólo dispone de las vistas
            operativas que se habiliten expresamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-4" onSubmit={invite}>
            <Field>
              <FieldLabel htmlFor="operator-name">Nombre</FieldLabel>
              <Input
                id="operator-name"
                onChange={(event) => setName(event.target.value)}
                required
                value={name}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="operator-email">Correo</FieldLabel>
              <Input
                id="operator-email"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="operator-role">Acceso</FieldLabel>
              <select
                className="border-input h-10 w-full rounded-md border bg-transparent px-3 text-sm"
                id="operator-role"
                onChange={(event) => {
                  if (isPlatformAdminRole(event.target.value)) setRole(event.target.value)
                }}
                value={role}
              >
                <option value="platform_support">Soporte de plataforma</option>
                <option value="platform_owner">Superadministrador</option>
              </select>
            </Field>
            <Button className="self-end" disabled={feedback.pending} type="submit">
              Enviar invitación
            </Button>
          </form>
        </CardContent>
      </Card>
      <FormFeedback pendingLabel="Actualizando acceso…" state={feedback.state} />
      <Card>
        <CardHeader>
          <CardTitle>Personas con acceso global</CardTitle>
          <CardDescription>
            {ownerCount} superadministradores activos. Los cambios se registran en la auditoría de
            plataforma.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {operators.map((operator) => {
            const manageable = canManagePlatformOperator({
              actorId: currentUserId,
              ownerCount,
              targetId: operator.userId,
              targetRole: operator.role,
            })
            return (
              <div
                className="border-border/70 bg-surface-subtle flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
                key={operator.userId}
              >
                <div>
                  <p className="font-medium">
                    {operator.name}
                    {operator.userId === currentUserId && ' · Tú'}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {operator.email} ·{' '}
                    {operator.role === 'platform_owner'
                      ? 'Superadministrador'
                      : 'Soporte de plataforma'}
                  </p>
                </div>
                {manageable && (
                  <div className="flex gap-2">
                    <select
                      aria-label={`Rol de ${operator.name}`}
                      className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
                      defaultValue={operator.role}
                      disabled={feedback.pending}
                      onChange={(event) => {
                        const nextRole = event.target.value
                        if (!isPlatformAdminRole(nextRole)) return
                        void run(
                          () =>
                            updatePlatformOperatorRole({
                              data: { role: nextRole, userId: operator.userId },
                            }),
                          'Rol de operador actualizado.',
                        )
                      }}
                    >
                      <option value="platform_support">Soporte</option>
                      <option value="platform_owner">Superadministrador</option>
                    </select>
                    <Button
                      disabled={feedback.pending}
                      onClick={() =>
                        void run(
                          () => revokePlatformOperator({ data: { userId: operator.userId } }),
                          'Acceso de plataforma revocado.',
                        )
                      }
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Revocar
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>
      {invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Invitaciones pendientes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {invitations.map((invitation) => (
              <p className="text-sm" key={invitation.email}>
                {invitation.email} ·{' '}
                {invitation.role === 'platform_owner' ? 'Superadministrador' : 'Soporte'} · caduca{' '}
                {new Date(invitation.expiresAt).toLocaleDateString('es-ES')}
              </p>
            ))}
          </CardContent>
        </Card>
      )}
    </main>
  )
}
