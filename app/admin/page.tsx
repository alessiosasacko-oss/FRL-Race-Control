import AppLayout from "@/components/layout/AppLayout";
import EmptyState from "@/components/ui/EmptyState";

export default function AdminPage() {
  return (
    <AppLayout>
      <EmptyState
        title="Administration"
        description="Die Verwaltungsfunktionen werden in einer späteren Phase umgesetzt."
      />
    </AppLayout>
  );
}
