import { describe, expect, it } from 'vitest'

import {
  canUseModule,
  hasModuleDependencies,
  isModuleEnabledForRole,
  MODULE_KEYS,
  MODULE_DEFINITIONS,
} from './modules'

describe('module catalog', () => {
  it('keeps core available to every tenant role', () => {
    for (const role of ['owner', 'manager', 'host', 'waiter', 'accountant'] as const) {
      expect(canUseModule('core', role)).toBe(true)
    }
  })

  it('does not expose financial controls to room roles', () => {
    expect(canUseModule('finance', 'waiter')).toBe(false)
    expect(canUseModule('finance', 'host')).toBe(false)
    expect(canUseModule('finance', 'accountant')).toBe(true)
  })

  it('requires dependencies before enabling a module', () => {
    expect(hasModuleDependencies('inventory', new Set())).toBe(false)
    expect(hasModuleDependencies('inventory', new Set(['core']))).toBe(true)
    expect(isModuleEnabledForRole('inventory', new Set(['core', 'inventory']), 'manager')).toBe(
      true,
    )
    expect(isModuleEnabledForRole('inventory', new Set(['inventory']), 'manager')).toBe(false)
  })

  it('defines every catalog key exactly once', () => {
    expect(Object.keys(MODULE_DEFINITIONS)).toHaveLength(MODULE_KEYS.length)
    expect(Object.keys(MODULE_DEFINITIONS).sort()).toEqual([...MODULE_KEYS].sort())
  })
})
