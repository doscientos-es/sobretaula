import { redirect } from '@tanstack/react-router'

/** Gives every protected platform loader the same session-expiry behavior. */
export async function loadPlatformRoute<T>(redirectTo: string, load: () => Promise<T>): Promise<T> {
  try {
    return await load()
  } catch (error) {
    if (error instanceof Response && error.status === 401) {
      throw redirect({ to: '/login', search: { redirect: redirectTo } })
    }
    throw error
  }
}
