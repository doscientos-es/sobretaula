import type { FloorPlanElement, FloorPlanTablePlacement } from './floor-plan'

export const FLOOR_PLAN_TEMPLATE_VERSION = 1

export interface LayoutTemplate {
  format: 'sobretaula-floor-plan-template'
  version: 1
  heightCm: number
  widthCm: number
  tables: Array<
    Pick<FloorPlanTablePlacement, 'code' | 'heightCm' | 'rotationDeg' | 'widthCm' | 'xCm' | 'yCm'>
  >
  elements: Array<
    Pick<
      FloorPlanElement,
      'heightCm' | 'kind' | 'label' | 'rotationDeg' | 'widthCm' | 'xCm' | 'yCm'
    >
  >
}

export function createLayoutTemplate(input: {
  heightCm: number
  widthCm: number
  tables: readonly FloorPlanTablePlacement[]
  elements: readonly FloorPlanElement[]
}): LayoutTemplate {
  return {
    format: 'sobretaula-floor-plan-template',
    version: FLOOR_PLAN_TEMPLATE_VERSION,
    heightCm: input.heightCm,
    widthCm: input.widthCm,
    tables: input.tables.map(({ code, heightCm, rotationDeg, widthCm, xCm, yCm }) => ({
      code,
      heightCm,
      rotationDeg,
      widthCm,
      xCm,
      yCm,
    })),
    elements: input.elements.map(({ heightCm, kind, label, rotationDeg, widthCm, xCm, yCm }) => ({
      heightCm,
      kind,
      label,
      rotationDeg,
      widthCm,
      xCm,
      yCm,
    })),
  }
}

export function serializeLayoutTemplate(template: LayoutTemplate): string {
  return JSON.stringify(template, null, 2)
}

export function parseLayoutTemplate(value: string): LayoutTemplate {
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    throw new Error('La plantilla no es un JSON válido.')
  }
  if (!parsed || typeof parsed !== 'object')
    throw new Error('La plantilla no tiene un formato válido.')
  const candidate = parsed as Partial<LayoutTemplate>
  if (candidate.format !== 'sobretaula-floor-plan-template' || candidate.version !== 1)
    throw new Error('Versión de plantilla no compatible.')
  if (
    !Number.isFinite(candidate.widthCm) ||
    !Number.isFinite(candidate.heightCm) ||
    !Array.isArray(candidate.tables) ||
    !Array.isArray(candidate.elements)
  )
    throw new Error('La plantilla está incompleta.')
  return candidate as LayoutTemplate
}
