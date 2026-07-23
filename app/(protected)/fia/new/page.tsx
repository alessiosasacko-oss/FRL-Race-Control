import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import NewTicketWizard from "@/components/fia/new-ticket/NewTicketWizard";
import { Permission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { getTicketWizardOptions } from "@/lib/fia/queries";

export default async function NewTicketPage() {
  await requirePermission(Permission.SubmitFiaTicket);
  const options = await getTicketWizardOptions();

  return (
    <AppLayout>
      <PageHeader
        title="Neues FIA Ticket"
        subtitle="Erstelle einen neuen Vorfall für die Stewards."
      />

      <div className="mt-8">
        <NewTicketWizard options={options} />
      </div>
    </AppLayout>
  );
}
