import type { TenantRole } from './tenant'

export const MODULE_KEYS = [
  'core',
  'inventory',
  'reservations_pro',
  'loyalty',
  'workforce',
  'finance',
  'online_ordering',
  'analytics',
  'automation',
  'multi_venue',
] as const

export type ModuleKey = (typeof MODULE_KEYS)[number]

export interface ModuleDefinition {
  key: ModuleKey
  label: string
  description: string
  dependencies: readonly ModuleKey[]
  roles: readonly TenantRole[]
}

const managementRoles: readonly TenantRole[] = ['owner', 'manager', 'accountant']
const operationalRoles: readonly TenantRole[] = ['owner', 'manager', 'waiter', 'host']

export const MODULE_DEFINITIONS: Record<ModuleKey, ModuleDefinition> = {
  core: {
    key: 'core',
    label: 'Operativa',
    description: 'TPV, mesas, servicio, caja, carta y reservas básicas.',
    dependencies: [],
    roles: ['owner', 'manager', 'host', 'waiter', 'accountant'],
  },
  inventory: {
    key: 'inventory',
    label: 'Inventario y escandallos',
    description: 'Ingredientes, recetas, costes, compras y stock.',
    dependencies: ['core'],
    roles: managementRoles,
  },
  reservations_pro: {
    key: 'reservations_pro',
    label: 'Reservas Pro',
    description: 'Lista de espera, depósitos, recordatorios y no-shows.',
    dependencies: ['core'],
    roles: operationalRoles,
  },
  loyalty: {
    key: 'loyalty',
    label: 'Clientes y fidelización',
    description: 'Clientes, puntos, campañas y tarjetas regalo.',
    dependencies: ['core'],
    roles: managementRoles,
  },
  workforce: {
    key: 'workforce',
    label: 'Equipo y turnos',
    description: 'Fichajes, turnos, ausencias y propinas.',
    dependencies: ['core'],
    roles: managementRoles,
  },
  finance: {
    key: 'finance',
    label: 'Finanzas',
    description: 'Facturación, conciliación, gastos y exportación contable.',
    dependencies: ['core'],
    roles: ['owner', 'manager', 'accountant'],
  },
  online_ordering: {
    key: 'online_ordering',
    label: 'Pedidos online',
    description: 'Pedidos para recoger o entregar y carta pública.',
    dependencies: ['core'],
    roles: operationalRoles,
  },
  analytics: {
    key: 'analytics',
    label: 'Analítica avanzada',
    description: 'Rentabilidad, previsiones y comparativa de locales.',
    dependencies: ['core'],
    roles: managementRoles,
  },
  automation: {
    key: 'automation',
    label: 'Automatizaciones',
    description: 'Alertas, tareas y comunicaciones automáticas.',
    dependencies: ['core'],
    roles: ['owner', 'manager'],
  },
  multi_venue: {
    key: 'multi_venue',
    label: 'Multi-local',
    description: 'Catálogo compartido, permisos y métricas consolidadas.',
    dependencies: ['core'],
    roles: ['owner', 'manager'],
  },
}

export function canUseModule(moduleKey: ModuleKey, role: TenantRole): boolean {
  return MODULE_DEFINITIONS[moduleKey].roles.includes(role)
}

export function hasModuleDependencies(
  moduleKey: ModuleKey,
  enabledModules: ReadonlySet<ModuleKey>,
): boolean {
  return MODULE_DEFINITIONS[moduleKey].dependencies.every((dependency) =>
    enabledModules.has(dependency),
  )
}

export function isModuleEnabledForRole(
  moduleKey: ModuleKey,
  enabledModules: ReadonlySet<ModuleKey>,
  role: TenantRole,
): boolean {
  return (
    enabledModules.has(moduleKey) &&
    canUseModule(moduleKey, role) &&
    hasModuleDependencies(moduleKey, enabledModules)
  )
}
