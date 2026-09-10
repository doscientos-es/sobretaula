export const reservationStatusLabels: Record<string, string> = {
  cancelled: 'Cancelada',
  completed: 'Completada',
  confirmed: 'Confirmada',
  no_show: 'No presentada',
  pending: 'Pendiente',
  seated: 'Sentada',
}

export function reservationStatusLabel(status: string): string {
  return reservationStatusLabels[status] ?? status
}
