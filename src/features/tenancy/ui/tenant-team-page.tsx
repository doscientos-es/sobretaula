import {
  Avatar,
  AvatarFallback,
  Badge,
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
  invitationEmailRateLimitMessage,
  isInvitationEmailRateLimited,
} from '@/shared/lib/supabase/auth-email-rate-limit'

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

function teamErrorMessage(error: unknown): string {
  if (isInvitationEmailRateLimited(error)) return invitationEmailRateLimitMessage
  const code = error instanceof Error ? error.message : ''
  if (code.includes('tenant_invitation_delivery_failed'))
    return 'No se pudo enviar la invitación. Comprueba el correo e inténtalo de nuevo.'
  if (code.includes('team_profile_lookup_failed'))
    return 'No se pudo consultar la cuenta del trabajador. Inténtalo de nuevo.'
  if (code.includes('tenant_invitation_save_failed:42501'))
    return 'No tienes permisos para enviar invitaciones en este restaurante.'
  if (code.includes('tenant_invitation_save_failed'))
    return 'No se pudo guardar la invitación. Comprueba que el restaurante esté disponible e inténtalo de nuevo.'
  if (code.includes('team_member_upsert_failed'))
    return 'No se pudo incorporar la cuenta existente. Inténtalo de nuevo o usa una invitación.'
  if (error instanceof Response && error.status === 403)
    return 'No tienes permisos para añadir este rol.'
  return 'No se ha podido actualizar el equipo. Revisa tus permisos e inténtalo de nuevo.'
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
    } catch (error) {
      feedback.setError(teamErrorMessage(error))
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
      <PageHeader className="border-border/70 border-b pb-6">
        <div>
          <PageHeaderTitle>Equipo</PageHeaderTitle>
          <PageHeaderDescription>
            Da acceso a las personas que hacen que el restaurante funcione cada día.
          </PageHeaderDescription>
        </div>
      </PageHeader>
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
                className="border-border/70 bg-surface-subtle flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
                key={member.userId}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="bg-primary/10 text-primary" size="lg">
                    <AvatarFallback>{member.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{member.name}</p>
                    <p className="text-muted-foreground truncate text-sm">{member.email}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Badge variant="default">{roleLabel[member.role]}</Badge>
                      <Badge variant={member.status === 'active' ? 'success' : 'warning'}>
                        {member.status === 'active' ? 'Activo' : 'Sin acceso'}
                      </Badge>
                    </div>
                  </div>
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
