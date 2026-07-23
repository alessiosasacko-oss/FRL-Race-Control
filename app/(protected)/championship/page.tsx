import AppLayout from "@/components/layout/AppLayout";
import EmptyState from "@/components/ui/EmptyState";

export default function ChampionshipPage() {
  return (
    <AppLayout>
      <EmptyState
        title="Meisterschaft"
        description="Die Meisterschaftstabelle wird in einer späteren Phase angebunden."
      />
    </AppLayout>
  );
}
