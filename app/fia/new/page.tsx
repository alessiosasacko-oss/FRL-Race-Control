import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import TicketForm from "@/components/fia/TicketForm";

export default function NewTicketPage() {
  return (
    <AppLayout>
      <PageHeader
        title="Neues FIA Ticket"
        subtitle="Erstelle einen neuen Vorfall für die Stewards."
      />

      <div className="mt-8">
        <TicketForm />
      </div>
    </AppLayout>
  );
}