import { Button } from '@doscientos/ui'
import { useState } from 'react'

import { logout } from '../application/authentication'

export function LogoutButton() {
  const [pending, setPending] = useState(false)

  async function signOut() {
    setPending(true)
    try {
      await logout({ data: {} })
    } finally {
      window.location.assign('/login')
    }
  }

  return (
    <Button onPress={() => void signOut()} size="sm" variant="ghost" disabled={pending}>
      Salir
    </Button>
  )
}
