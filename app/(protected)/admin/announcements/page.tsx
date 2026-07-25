import AppLayout from "@/components/layout/AppLayout";
import AnnouncementForm from "@/components/notifications/AnnouncementForm";
import { Permission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";

export default async function AnnouncementsAdminPage() {
  await requirePermission(Permission.ManageAdministration);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Kommunikation
          </h1>
          <p className="mt-2 text-slate-400">
            Plattformweite Mitteilungen kontrolliert veröffentlichen.
          </p>
        </div>
        <AnnouncementForm />
      </div>
    </AppLayout>
  );
}
