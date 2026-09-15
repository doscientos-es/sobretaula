import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { LoginPage } from "@/features/auth/ui/login-page";

const loginSearch = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/login")({
  component: LoginRoute,
  validateSearch: loginSearch,
});

function LoginRoute() {
  const { redirect } = Route.useSearch();
  return (
    <LoginPage {...(redirect === undefined ? {} : { redirectTo: redirect })} />
  );
}
