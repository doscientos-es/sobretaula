import type { ServiceBoard } from '@/features/service'

export interface PosTerminalSummary {
  activeSessions: number
  availableTables: number
  blockedTables: number
  cleaningTables: number
  pendingItems: number
  readyItems: number
  reservedTables: number
}

/** Compact operational counts for the terminal home without duplicating service rules. */
export function summarizePosTerminal(board: ServiceBoard): PosTerminalSummary {
  const tickets = board.kitchenTickets ?? []
  return {
    activeSessions: board.sessions.length,
    availableTables: board.tables.filter((table) => table.status === 'free').length,
    blockedTables: board.tables.filter((table) => table.status === 'blocked').length,
    cleaningTables: board.tables.filter((table) => table.status === 'cleaning').length,
    pendingItems: tickets.filter((ticket) => ['pending', 'preparing'].includes(ticket.status))
      .length,
    readyItems: tickets.filter((ticket) => ticket.status === 'ready').length,
    reservedTables: board.tables.filter((table) => table.status === 'reserved').length,
  }
}
