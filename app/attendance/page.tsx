import AppLayout from "@/components/layout/AppLayout";
import EmptyState from "@/components/ui/EmptyState";

export default function AttendancePage() {
  return (
    <AppLayout>
      <EmptyState
        title="Rennanmeldung"
        description="Die Rennanmeldung wird in einer späteren Phase umgesetzt."
      />
    </AppLayout>
  );
}
