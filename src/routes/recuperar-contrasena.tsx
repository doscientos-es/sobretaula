import { createFileRoute } from "@tanstack/react-router";

import { ForgotPasswordPage } from "@/features/auth/ui/forgot-password-page";

export const Route = createFileRoute("/recuperar-contrasena")({
  component: ForgotPasswordPage,
});
