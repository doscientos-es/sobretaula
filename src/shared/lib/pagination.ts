export const DEFAULT_PAGE_SIZE = 25
export const MAX_PAGE_SIZE = 100

export interface PaginationInput {
  page: number
  pageSize: number
}

export interface PaginatedResult<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  hasMore: boolean
}

export function paginationRange({ page, pageSize }: PaginationInput) {
  const from = (page - 1) * pageSize
  return { from, to: from + pageSize - 1 }
}
