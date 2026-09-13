export interface LaborCostInput {
  employeeId: string
  workedMinutes: number
  hourlyCostCents: number | null
}

export function calculateLaborCosts(rows: readonly LaborCostInput[]) {
  const byEmployee = rows.map((row) => ({
    ...row,
    costAvailable: row.hourlyCostCents !== null,
    costCents:
      row.hourlyCostCents === null ? 0 : Math.round((row.workedMinutes / 60) * row.hourlyCostCents),
  }))
  return {
    byEmployee,
    totalCostCents: byEmployee.reduce((sum, row) => sum + row.costCents, 0),
    costAvailable: byEmployee.every((row) => row.costAvailable),
  }
}
