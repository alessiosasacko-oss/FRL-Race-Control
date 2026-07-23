import AppLayout from "@/components/layout/AppLayout";
import EmptyState from "@/components/ui/EmptyState";

export default function ProfilePage() {
  return (
    <AppLayout>
      <EmptyState
        title="Profil"
        description="Die Profilverwaltung wird in einer späteren Phase umgesetzt."
      />
    </AppLayout>
  );
}
