import AppLayout from "@/components/layout/AppLayout";
import EmptyState from "@/components/ui/EmptyState";
import { Permission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";

export default async function AdminPage() {
  await requirePermission(Permission.ManageAdministration);

  return (
    <AppLayout>
      <EmptyState
        title="Administration"
        description="Die Verwaltungsfunktionen werden in einer späteren Phase umgesetzt."
      />
    </AppLayout>
  );
}
