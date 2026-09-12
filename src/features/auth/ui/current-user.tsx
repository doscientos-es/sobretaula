import { Avatar, AvatarFallback, Button, DropdownMenu, DropdownMenuItem } from '@doscientos/ui'
import { EllipsisVertical, LogOut } from 'lucide-react'
import { useEffect, useState } from 'react'

import { DEFAULT_LOCALE, type Locale } from '@/shared/lib/i18n/locale'
import { createTranslator } from '@/shared/lib/i18n/messages'

import { getCurrentUser, type CurrentUser } from '../application/authentication'
import { useLogout } from './logout-button'

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
export function CurrentUserSidebar({ locale = DEFAULT_LOCALE }: { locale?: Locale }) {
  const t = createTranslator(locale)
  const user = useCurrentUser()
  const { pending: logoutPending, signOut } = useLogout()
  const displayName = user?.displayName ?? 'Cuenta'

  return (
    <footer className="st-saas-user-menu border-border/70 sticky bottom-0 z-10 mt-auto flex shrink-0 items-center gap-2 border-t px-1.5 pt-3 pb-1">
      <Avatar className="bg-primary/10 text-primary" size="sm">
        <AvatarFallback>{userInitials(displayName)}</AvatarFallback>
      </Avatar>
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium">{displayName}</span>
        {user && (
          <span className="text-muted-foreground block truncate text-[0.625rem]">{user.email}</span>
        )}
      </span>
      <DropdownMenu
        className="z-[60] w-52"
        offset={8}
        placement="top end"
        trigger={
          <Button aria-label={t('common.accountActions')} size="icon" variant="ghost">
            <EllipsisVertical aria-hidden="true" className="size-4" />
          </Button>
        }
      >
        <DropdownMenuItem
          isDisabled={logoutPending}
          onPress={() => void signOut()}
          textValue={t('common.logout')}
        >
          <LogOut className="size-3.5" /> {t('common.logout')}
        </DropdownMenuItem>
      </DropdownMenu>
    </footer>
  )
}
