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
import { useState, type FormEvent } from 'react'

import { useLoaderReload } from '@/shared/lib/router/use-loader-reload'

import {
  inviteTenantMember,
  suspendTenantMember,
  updateTenantMemberRole,
  type TenantTeam,
} from '../application/team'
import {
  ASSIGNABLE_TENANT_ROLES,
  canManageTeamMember,
  isAssignableTenantRole,
} from '../domain/team'
import type { TenantRole } from '../domain/tenant'

const roleLabel: Record<TenantRole, string> = {
  accountant: 'Administración',
  host: 'Jefe de sala',
  manager: 'Gerente',
  owner: 'Propietario',
  waiter: 'Camarero',
}

function selectedRole(value: string): (typeof ASSIGNABLE_TENANT_ROLES)[number] {
  return isAssignableTenantRole(value) ? value : 'waiter'
}

function rolesFor(viewerRole: TenantRole) {
  return ASSIGNABLE_TENANT_ROLES.filter(
    (candidate) => viewerRole === 'owner' || candidate !== 'manager',
  )
}

/** Lets owners and managers add staff, while every team member can see who operates the venue. */
export function TenantTeamPage({
  team,
  tenantId,
  viewerId,
  viewerRole,
}: {
  team: TenantTeam
  tenantId: string
  viewerId: string
  viewerRole: TenantRole
}) {
  const feedback = useFormFeedback()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<(typeof ASSIGNABLE_TENANT_ROLES)[number]>('waiter')
  const reload = useLoaderReload()

  async function run(action: () => Promise<unknown>, success: string) {
    feedback.setPending()
    try {
      await action()
      feedback.setSuccess(success)
      reload()
    } catch {
      feedback.setError(
        'No se ha podido actualizar el equipo. Revisa tus permisos e inténtalo de nuevo.',
      )
    }
  }

  function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void run(async () => {
      const result = await inviteTenantMember({ data: { email, name, role, tenantId } })
      setName('')
      setEmail('')
      return result
    }, 'Trabajador añadido o invitación enviada.')
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Equipo</h1>
        <p className="text-muted-foreground mt-1">
          Da acceso a las personas que trabajan en tu restaurante.
        </p>
      </header>
      {(viewerRole === 'owner' || viewerRole === 'manager') && (
        <Card>
          <CardHeader>
            <CardTitle>Añadir trabajador</CardTitle>
            <CardDescription>
              Si ya tiene cuenta se incorpora al momento; si no, recibirá una invitación.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 sm:grid-cols-4" onSubmit={invite}>
              <Field>
                <FieldLabel htmlFor="member-name">Nombre</FieldLabel>
                <Input
                  id="member-name"
                  onChange={(e) => setName(e.target.value)}
                  required
                  value={name}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="member-email">Correo</FieldLabel>
                <Input
                  id="member-email"
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  type="email"
                  value={email}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="member-role">Rol</FieldLabel>
                <select
                  className="border-input h-10 w-full rounded-md border bg-transparent px-3 text-sm"
                  id="member-role"
                  onChange={(e) => setRole(selectedRole(e.target.value))}
                  value={role}
                >
                  {rolesFor(viewerRole).map((candidate) => (
                    <option key={candidate} value={candidate}>
                      {roleLabel[candidate]}
                    </option>
                  ))}
                </select>
              </Field>
              <Button className="self-end" disabled={feedback.pending} type="submit">
                Añadir
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
      <FormFeedback pendingLabel="Actualizando equipo…" state={feedback.state} />
      <Card>
        <CardHeader>
          <CardTitle>Personas con acceso</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {team.members.map((member) => {
            const manageable = canManageTeamMember({
              actorId: viewerId,
              actorRole: viewerRole,
              targetId: member.userId,
              targetRole: member.role,
            })
            return (
              <div
                className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 last:border-0 last:pb-0"
                key={member.userId}
              >
                <div>
                  <p className="font-medium">{member.name}</p>
                  <p className="text-muted-foreground text-sm">
                    {member.email} · {roleLabel[member.role]} ·{' '}
                    {member.status === 'active' ? 'Activo' : 'Sin acceso'}
                  </p>
                </div>
                {manageable && (
                  <div className="flex gap-2">
                    <select
                      aria-label={`Rol de ${member.name}`}
                      className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
                      defaultValue={member.role}
                      onChange={(e) =>
                        void run(
                          () =>
                            updateTenantMemberRole({
                              data: {
                                role: selectedRole(e.target.value),
                                tenantId,
                                userId: member.userId,
                              },
                            }),
                          'Rol actualizado.',
                        )
                      }
                    >
                      {rolesFor(viewerRole).map((candidate) => (
                        <option key={candidate} value={candidate}>
                          {roleLabel[candidate]}
                        </option>
                      ))}
                    </select>
                    {member.status === 'active' && (
                      <Button
                        disabled={feedback.pending}
                        onClick={() =>
                          void run(
                            () =>
                              suspendTenantMember({ data: { tenantId, userId: member.userId } }),
                            'Acceso desactivado.',
                          )
                        }
                        type="button"
                        variant="outline"
                      >
                        Desactivar
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>
      {team.invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Invitaciones pendientes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {team.invitations.map((invitation) => (
              <p key={invitation.email} className="text-sm">
                {invitation.email} · {roleLabel[invitation.role]} · caduca{' '}
                {new Date(invitation.expiresAt).toLocaleDateString('es-ES')}
              </p>
            ))}
          </CardContent>
        </Card>
      )}
    </section>
  )
}
