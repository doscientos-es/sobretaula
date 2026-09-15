import { createFileRoute } from '@tanstack/react-router'

import { PasswordResetPage } from '@/features/auth/ui/password-reset-page'

export const Route = createFileRoute('/restablecer-contrasena')({ component: PasswordResetPage })
