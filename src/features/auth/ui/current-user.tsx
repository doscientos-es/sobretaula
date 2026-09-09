import { Avatar, AvatarFallback } from '@doscientos/ui'
import { useEffect, useState } from 'react'

import { getCurrentUser, type CurrentUser } from '../application/authentication'

export function userInitials(displayName: string): string {
  const words = displayName.trim().split(/\s+/).filter(Boolean)
  return words.length > 1
    ? `${words.at(0)?.at(0) ?? ''}${words.at(-1)?.at(0) ?? ''}`.toUpperCase()
    : displayName.trim().slice(0, 2).toUpperCase()
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null)

  useEffect(() => {
    void getCurrentUser()
      .then(setUser)
      .catch(() => undefined)
  }, [])

  return user
}

/** Compact identity shown at the bottom of authenticated sidebars. */
export function CurrentUserSidebar() {
  const user = useCurrentUser()
  const displayName = user?.displayName ?? 'Cuenta'

  return (
    <div className="border-border/70 mt-auto flex shrink-0 items-center gap-2 border-t px-1.5 pt-3">
      <Avatar className="bg-primary/10 text-primary" size="sm">
        <AvatarFallback>{userInitials(displayName)}</AvatarFallback>
      </Avatar>
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium">{displayName}</span>
        {user && (
          <span className="text-muted-foreground block truncate text-[0.625rem]">{user.email}</span>
        )}
      </span>
    </div>
  )
}
