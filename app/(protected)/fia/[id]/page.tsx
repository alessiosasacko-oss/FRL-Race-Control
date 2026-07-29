import { notFound } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import ArchiveTicketControls from "@/components/fia/ArchiveTicketControls";
import DecisionCard from "@/components/fia/DecisionCard";
import DescriptionCard from "@/components/fia/DescriptionCard";
import DiscussionCard from "@/components/fia/DiscussionCard";
import DriversCard from "@/components/fia/DriversCard";
import EvidenceCard from "@/components/fia/EvidenceCard";
import GeneralInfoCard from "@/components/fia/GeneralInfoCard";
import HistoryCard from "@/components/fia/HistoryCard";
import InvestigationHeader from "@/components/fia/InvestigationHeader";
import StatusCard from "@/components/fia/StatusCard";
import VotingCard from "@/components/fia/VotingCard";
import { TicketStatus } from "@/domain";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { canParticipateInProposal } from "@/lib/fia/proposal-policy";
import { getFiaTicketById } from "@/lib/fia/queries";
import { ticketIdSchema } from "@/lib/fia/schemas";
import { getVideoUploadLimits } from "@/lib/storage/evidence-config";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function InvestigationPage({ params }: Props) {
  const { id } = await params;
  const parsedId = ticketIdSchema.safeParse(id);

  if (!parsedId.success) {
    notFound();
  }

  const user = await requirePermission(Permission.ViewRaceControl);
  const canReview = hasPermission(user.roles, Permission.ReviewFiaTicket);
  const ticket = await getFiaTicketById(parsedId.data, {
    includeInternal: canReview,
  });

  if (!ticket) {
    notFound();
  }

  const canArchive = hasPermission(
    user.roles,
    Permission.ArchiveFiaTicket,
  );
  const isRelated =
    ticket.reportedBy?.id === user.id ||
    ticket.drivers.some((driver) => driver.userId === user.id);
  const canViewEvidence = canReview || isRelated;
  const canAddEvidence =
    !ticket.archivedAt &&
    ticket.status !== TicketStatus.Resolved &&
    (canReview || isRelated);
  const canVote = canParticipateInProposal({
    roles: user.roles,
    userId: user.id,
    assignedStewardIds: ticket.assignedStewards.map((steward) => steward.id),
  });
  const proposals = ticket.discussionMessages.flatMap((message) =>
    message.proposal ? [message.proposal] : [],
  );
  return (
    <AppLayout>
      <div className="page-stack">
        <InvestigationHeader ticket={ticket} />

        {ticket.archivedAt ? (
          <section className="flex flex-col gap-4 rounded-2xl border border-blue-500/25 bg-blue-500/10 p-5 text-blue-100 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-bold">Archivierter FIA-Fall</p>
              <p className="mt-1 text-sm text-blue-100/75">
                Archiviert am{" "}
                {new Intl.DateTimeFormat("de-DE", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(ticket.archivedAt))}{" "}
                von {ticket.archivedBy?.displayName ?? "Unbekannt"}. Alle
                Inhalte sind schreibgeschützt.
              </p>
            </div>
            <div className="sm:w-72">
              <ArchiveTicketControls
                ticketId={ticket.id}
                archived
                canArchive={canArchive}
              />
            </div>
          </section>
        ) : ticket.status === TicketStatus.Resolved ? (
          <div className="ml-auto w-full sm:w-72">
            <ArchiveTicketControls
              ticketId={ticket.id}
              archived={false}
              canArchive={canArchive}
            />
          </div>
        ) : null}

        <div className="grid items-start gap-5 xl:grid-cols-12">
          <aside className="space-y-5 xl:col-span-3">
            <StatusCard ticket={ticket} canReview={canReview} />
            <GeneralInfoCard ticket={ticket} />
            <DescriptionCard ticket={ticket} />
            <DriversCard ticket={ticket} />
          </aside>

          <main className="min-w-0 xl:col-span-6">
            {canReview ? (
              <DiscussionCard
                ticketId={ticket.id}
                status={ticket.status}
                messages={ticket.discussionMessages}
                drivers={ticket.drivers}
                evidence={ticket.evidence}
                mentionCandidates={ticket.mentionCandidates}
                currentUser={{
                  id: user.id,
                  displayName: user.displayName,
                }}
                canVote={canVote && !ticket.archivedAt}
                canDecide={canVote && !ticket.archivedAt}
              />
            ) : (
              <section className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-6 text-sm leading-6 text-slate-300">
                Die interne Steward-Kommunikation ist nur dem
                Race-Control-Team zugänglich.
              </section>
            )}
          </main>

          <aside className="min-w-0 xl:col-span-3">
            {canViewEvidence ? (
              <EvidenceCard
                ticketId={ticket.id}
                evidence={ticket.evidence}
                canAddEvidence={canAddEvidence}
                uploadLimits={getVideoUploadLimits()}
              />
            ) : (
              <section className="rounded-2xl border border-slate-800 bg-[#101720] p-6 text-sm text-slate-400">
                Beweise sind nur für beteiligte Fahrer und das
                Race-Control-Team sichtbar.
              </section>
            )}
          </aside>
        </div>

        <section className="page-section">
          <div className="mb-5">
            <p className="eyebrow">Resolution desk</p>
            <h2 className="mt-2 text-2xl font-bold text-white">
              Abstimmung & Entscheidung
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Steward-Abstimmungen und offizieller Abschluss des Vorgangs.
            </p>
          </div>
          <div className="grid items-start gap-5 xl:grid-cols-2">
            {canReview && ticket.votes.length > 0 ? (
              <VotingCard
                ticketId={ticket.id}
                status={ticket.status}
                votes={ticket.votes}
                currentUserId={user.id}
                readOnly
              />
            ) : canReview && proposals.length === 0 ? (
              <section className="rounded-2xl border border-slate-800 bg-[#151B24] p-5 sm:p-6">
                <h2 className="text-xl font-bold text-white">
                  Steward-Abstimmungen
                </h2>
                <p className="mt-5 text-slate-400">
                  Noch keine Abstimmung vorhanden.
                </p>
              </section>
            ) : null}
            <DecisionCard
              ticketId={ticket.id}
              status={ticket.status}
              decision={ticket.decision}
              drivers={ticket.drivers}
              proposals={proposals}
              canFinalize={canVote}
              readOnly={ticket.archivedAt !== null}
            />
          </div>
        </section>

        <section className="page-section">
          <HistoryCard ticket={ticket} />
        </section>
      </div>
    </AppLayout>
  );
}
