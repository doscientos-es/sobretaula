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
  FieldDescription,
  FieldLabel,
  FormFeedback,
  Input,
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectList,
  SelectTrigger,
  SelectValue,
  useFormFeedback,
} from '@doscientos/ui'
import { useState, type FormEvent } from 'react'

import { useAsyncEffect } from '@/shared/lib/react/use-async-effect'
import { useLoaderReload } from '@/shared/lib/router/use-loader-reload'

import {
  getTenantTeam,
  inviteTenantMember,
  resendTenantInvitation,
  suspendTenantMember,
  updateTenantMemberRole,
  type TenantTeam,
} from '../application/team'
import { teamErrorMessage, teamInvitationSuccessMessage } from '../application/team-error'
import { teamInvitationFormError } from '../application/team-invitation-input'
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
  const [visibleTeam, setVisibleTeam] = useState(team)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(team.page)
  const [teamLoading, setTeamLoading] = useState(false)
  const [teamError, setTeamError] = useState<string | null>(null)
  const [teamRefresh, setTeamRefresh] = useState(0)
  const [resendingEmail, setResendingEmail] = useState<string | null>(null)
  useAsyncEffect(() => {
    let active = true
    setTeamLoading(true)
    setTeamError(null)
    void getTenantTeam({ data: { tenantId, page, pageSize: team.pageSize, search } })
      .then((result) => {
        if (active) setVisibleTeam(result)
      })
      .catch(() => {
        if (active) setTeamError('No se ha podido cargar el equipo.')
      })
      .finally(() => {
        if (active) setTeamLoading(false)
      })
    return () => {
      active = false
    }
  }, [page, search, team.pageSize, teamRefresh, tenantId])

  async function run<Result>(
    action: () => Promise<Result>,
    success: string | ((result: Result) => string),
  ) {
    feedback.setPending()
    try {
      const result = await action()
      feedback.setSuccess(typeof success === 'function' ? success(result) : success)
      reload()
    } catch (error) {
      feedback.setError(teamErrorMessage(error))
    }
  }

  function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (feedback.pending) return

    const validationError = teamInvitationFormError({ email, name, role })
    if (validationError) {
      feedback.setError(validationError)
      return
    }

    void run(
      async () => {
        const result = await inviteTenantMember({
          data: {
            email: email.trim().toLowerCase(),
            name: name.trim() || undefined,
            role,
            tenantId,
          },
        })
        setName('')
        setEmail('')
        return result
      },
      (result) => teamInvitationSuccessMessage(result.kind),
    )
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
            <form className="grid gap-4 sm:grid-cols-4" noValidate onSubmit={invite}>
              <Field>
                <FieldLabel htmlFor="member-name">Nombre (si necesita invitación)</FieldLabel>
                <Input
                  autoComplete="name"
                  id="member-name"
                  maxLength={120}
                  name="name"
                  onChange={(e) => setName(e.target.value)}
                  value={name}
                />
                <FieldDescription>
                  Solo es necesario si esta persona aún no tiene cuenta.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="member-email">Correo</FieldLabel>
                <Input
                  autoCapitalize="none"
                  autoComplete="email"
                  id="member-email"
                  inputMode="email"
                  maxLength={254}
                  name="email"
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  type="email"
                  value={email}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="member-role">Rol</FieldLabel>
                <Select
                  id="member-role"
                  className="w-full"
                  onSelectionChange={(key) => setRole(selectedRole(String(key)))}
                  selectedKey={role}
                >
                  <SelectTrigger aria-label="Rol de la invitación">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectList>
                      {rolesFor(viewerRole).map((candidate) => (
                        <SelectItem id={candidate} key={candidate}>
                          {roleLabel[candidate]}
                        </SelectItem>
                      ))}
                    </SelectList>
                  </SelectContent>
                </Select>
              </Field>
              <Button className="self-end" disabled={feedback.pending} type="submit">
                Añadir
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
      <FormFeedback pendingLabel="Actualizando equipo…" state={feedback.state} />
      <Card aria-busy={teamLoading}>
        <CardHeader>
          <CardTitle>Personas con acceso</CardTitle>
          <CardDescription>
            {visibleTeam.total} personas · página {visibleTeam.page}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            aria-label="Buscar en el equipo"
            onChange={(event) => {
              setPage(1)
              setSearch(event.target.value)
            }}
            placeholder="Buscar por nombre o correo…"
            type="search"
            value={search}
          />
          {teamLoading ? (
            <output aria-busy="true" className="text-muted-foreground block text-sm">
              Cargando equipo…
            </output>
          ) : teamError ? (
            <div className="flex flex-wrap items-center justify-between gap-3" role="alert">
              <span className="text-destructive text-sm">{teamError}</span>
              <Button
                onClick={() => setTeamRefresh((current) => current + 1)}
                size="sm"
                type="button"
                variant="outline"
              >
                Reintentar
              </Button>
            </div>
          ) : visibleTeam.members.length === 0 ? (
            <div className="space-y-2">
              <p className="text-muted-foreground text-sm">
                {search
                  ? 'No hay personas que coincidan con la búsqueda.'
                  : 'Todavía no hay personas con acceso.'}
              </p>
              {search ? (
                <Button
                  onClick={() => {
                    setSearch('')
                    setPage(1)
                  }}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Limpiar búsqueda
                </Button>
              ) : null}
            </div>
          ) : (
            visibleTeam.members.map((member) => {
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
                      <Select
                        aria-label={`Rol de ${member.name}`}
                        defaultSelectedKey={member.role}
                        onSelectionChange={(key) =>
                          void run(
                            () =>
                              updateTenantMemberRole({
                                data: {
                                  role: selectedRole(String(key)),
                                  tenantId,
                                  userId: member.userId,
                                },
                              }),
                            'Rol actualizado.',
                          )
                        }
                      >
                        <SelectTrigger aria-label={`Rol de ${member.name}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectList>
                            {rolesFor(viewerRole).map((candidate) => (
                              <SelectItem id={candidate} key={candidate}>
                                {roleLabel[candidate]}
                              </SelectItem>
                            ))}
                          </SelectList>
                        </SelectContent>
                      </Select>
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
            })
          )}
          <div className="flex justify-end gap-2">
            <Button
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              size="sm"
              type="button"
              variant="outline"
            >
              Anterior
            </Button>
            <Button
              disabled={!visibleTeam.hasMore}
              onClick={() => setPage((current) => current + 1)}
              size="sm"
              type="button"
              variant="outline"
            >
              Siguiente
            </Button>
          </div>
        </CardContent>
      </Card>
      {visibleTeam.invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Invitaciones pendientes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {visibleTeam.invitations.map((invitation) => (
              <div
                key={invitation.email}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <p>
                  {invitation.email} · {roleLabel[invitation.role]} · caduca{' '}
                  {new Date(invitation.expiresAt).toLocaleDateString('es-ES')}
                </p>
                <Button
                  disabled={resendingEmail === invitation.email}
                  onClick={() => {
                    setResendingEmail(invitation.email)
                    feedback.setPending()
                    void resendTenantInvitation({ data: { tenantId, email: invitation.email } })
                      .then(() => {
                        feedback.setSuccess('Invitación reenviada.')
                        setTeamRefresh((current) => current + 1)
                      })
                      .catch(() => feedback.setError('No se ha podido reenviar la invitación.'))
                      .finally(() => setResendingEmail(null))
                  }}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {resendingEmail === invitation.email ? 'Enviando…' : 'Reenviar invitación'}
                </Button>
              </div>
            ))}
            <FormFeedback pendingLabel="Enviando invitación…" state={feedback.state} />
          </CardContent>
        </Card>
      )}
    </section>
  )
}
