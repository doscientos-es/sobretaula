export type OnlineOrderStatus =
  | 'pending'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'completed'
  | 'cancelled'
const transitions: Record<OnlineOrderStatus, OnlineOrderStatus[]> = {
  pending: ['accepted', 'cancelled'],
  accepted: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['completed'],
  completed: [],
  cancelled: [],
}
export function canAdvanceOnlineOrder(
  current: OnlineOrderStatus,
  next: OnlineOrderStatus,
): boolean {
  return transitions[current].includes(next)
}
