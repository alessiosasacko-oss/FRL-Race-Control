import AppLayout from "@/components/layout/AppLayout";
import EmptyState from "@/components/ui/EmptyState";

export default function CalendarPage() {
  return (
    <AppLayout>
      <EmptyState
        title="Kalender"
        description="Der Rennkalender wird in einer späteren Phase angebunden."
      />
    </AppLayout>
  );
}
