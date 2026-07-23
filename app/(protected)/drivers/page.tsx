import AppLayout from "@/components/layout/AppLayout";
import EmptyState from "@/components/ui/EmptyState";

export default function DriversPage() {
  return (
    <AppLayout>
      <EmptyState
        title="Fahrer"
        description="Die Fahrerverwaltung wird in einer späteren Phase umgesetzt."
      />
    </AppLayout>
  );
}
