import { createFileRoute } from "@tanstack/react-router";

import { getCurrentUser } from "@/features/auth";
import { SettingsPage } from "@/features/settings";

export const Route = createFileRoute("/t/$slug/ajustes")({
  loader: async () => getCurrentUser(),
  component: TenantSettingsRoute,
});

function TenantSettingsRoute() {
  return <SettingsPage user={Route.useLoaderData()} />;
}
