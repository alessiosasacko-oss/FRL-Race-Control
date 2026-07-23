import AppLayout from "@/components/layout/AppLayout";

import NextRaceCard from "@/components/dashboard/NextRaceCard";
import TasksCard from "@/components/dashboard/TasksCard";
import FiaCard from "@/components/dashboard/FiaCard";
import ChampionshipCard from "@/components/dashboard/ChampionshipCard";

export default function DashboardPage() {
  return (
    <AppLayout>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <NextRaceCard />

        <TasksCard />

        <FiaCard />
      </div>
    </AppLayout>
  );
}