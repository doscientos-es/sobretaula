import type { LayoutTemplate } from './layout-template'

export interface EventLayoutTemplate {
  id: string
  name: string
  activeFrom: string
  activeTo?: string | null
  areaIds: string[]
  layout: LayoutTemplate
}

export function isEventLayoutTemplateValid(template: EventLayoutTemplate): boolean {
  const name = template.name.trim()
  const from = new Date(template.activeFrom).getTime()
  const to = template.activeTo ? new Date(template.activeTo).getTime() : Number.POSITIVE_INFINITY
  return Boolean(name) && template.areaIds.length > 0 && Number.isFinite(from) && from < to
}

export function findEventTemplateConflicts(
  templates: readonly EventLayoutTemplate[],
): Array<{ firstTemplateId: string; secondTemplateId: string; areaId: string }> {
  const conflicts: Array<{ firstTemplateId: string; secondTemplateId: string; areaId: string }> = []
  for (let index = 0; index < templates.length; index += 1) {
    const first = templates[index]
    if (!first || !isEventLayoutTemplateValid(first)) continue
    const firstFrom = new Date(first.activeFrom).getTime()
    const firstTo = first.activeTo ? new Date(first.activeTo).getTime() : Number.POSITIVE_INFINITY
    for (const second of templates.slice(index + 1)) {
      if (!isEventLayoutTemplateValid(second)) continue
      const secondFrom = new Date(second.activeFrom).getTime()
      const secondTo = second.activeTo
        ? new Date(second.activeTo).getTime()
        : Number.POSITIVE_INFINITY
      const sharedArea = first.areaIds.find((areaId) => second.areaIds.includes(areaId))
      if (sharedArea && firstFrom < secondTo && secondFrom < firstTo)
        conflicts.push({
          firstTemplateId: first.id,
          secondTemplateId: second.id,
          areaId: sharedArea,
        })
    }
  }
  return conflicts
}
