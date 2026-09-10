import { createFileRoute } from '@tanstack/react-router'

import { PasswordResetPage } from '@/features/auth'

export const Route = createFileRoute('/restablecer-contrasena')({ component: PasswordResetPage })
