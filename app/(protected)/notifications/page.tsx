import AppLayout from "@/components/layout/AppLayout";
import EmptyState from "@/components/ui/EmptyState";

export default function NotificationsPage() {
  return (
    <AppLayout>
      <EmptyState
        title="Benachrichtigungen"
        description="Benachrichtigungen werden in einer späteren Phase angebunden."
      />
    </AppLayout>
  );
}
