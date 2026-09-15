import { createFileRoute } from "@tanstack/react-router";

import { RegisterPage } from "@/features/auth/ui/register-page";

export const Route = createFileRoute("/registro")({ component: RegisterPage });
