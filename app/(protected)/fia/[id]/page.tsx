import { notFound } from "next/navigation";

import AppLayout from "@/components/layout/AppLayout";

import InvestigationHeader from "@/components/fia/InvestigationHeader";
import DescriptionCard from "@/components/fia/DescriptionCard";
import DriversCard from "@/components/fia/DriversCard";
import StatusCard from "@/components/fia/StatusCard";

import { tickets } from "@/lib/data/tickets";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function InvestigationPage({ params }: Props) {
  const { id } = await params;

  const ticket = tickets.find((t) => t.id === Number(id));

  if (!ticket) {
    notFound();
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <InvestigationHeader ticket={ticket} />

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <DescriptionCard ticket={ticket} />
            <DriversCard ticket={ticket} />
          </div>

          <StatusCard ticket={ticket} />
        </div>
      </div>
    </AppLayout>
  );
}
