import { notFound } from "next/navigation";

import AppLayout from "@/components/layout/AppLayout";

import InvestigationHeader from "@/components/fia/InvestigationHeader";
import DescriptionCard from "@/components/fia/DescriptionCard";
import DriversCard from "@/components/fia/DriversCard";
import StatusCard from "@/components/fia/StatusCard";
import GeneralInfoCard from "@/components/fia/GeneralInfoCard";
import EvidenceCard from "@/components/fia/EvidenceCard";
import DiscussionCard from "@/components/fia/DiscussionCard";
import VotingCard from "@/components/fia/VotingCard";
import DecisionCard from "@/components/fia/DecisionCard";
import HistoryCard from "@/components/fia/HistoryCard";
import { getFiaTicketById } from "@/lib/fia/queries";
import { ticketIdSchema } from "@/lib/fia/schemas";
import {
  hasPermission,
  Permission,
} from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { TicketStatus } from "@/domain";
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
  const ticket = await getFiaTicketById(parsedId.data);

  if (!ticket) {
    notFound();
  }

  const canReview = hasPermission(
    user.roles,
    Permission.ReviewFiaTicket,
  );
  const canDecide = hasPermission(
    user.roles,
    Permission.DecideFiaTicket,
  );
  const isRelated =
    ticket.reportedBy?.id === user.id ||
    ticket.drivers.some((driver) => driver.userId === user.id);
  const canViewEvidence = canReview || isRelated;
  const canAddEvidence =
    ticket.status !== TicketStatus.Resolved && (canReview || isRelated);

  return (
    <AppLayout>
      <div className="space-y-6">
        <InvestigationHeader ticket={ticket} />

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <DescriptionCard ticket={ticket} />
            <DriversCard ticket={ticket} />
            {canViewEvidence ? (
              <EvidenceCard
                ticketId={ticket.id}
                evidence={ticket.evidence}
                canAddEvidence={canAddEvidence}
                uploadLimits={getVideoUploadLimits()}
              />
            ) : (
              <section className="rounded-2xl border border-slate-800 bg-[#151B24] p-6 text-sm text-slate-400">
                Beweise sind nur für beteiligte Fahrer und das Race-Control-Team
                sichtbar.
              </section>
            )}
            {canReview ? (
              <>
                <DiscussionCard
                  ticketId={ticket.id}
                  status={ticket.status}
                  messages={ticket.discussionMessages}
                />
                <VotingCard
                  ticketId={ticket.id}
                  status={ticket.status}
                  votes={ticket.votes}
                  currentUserId={user.id}
                />
              </>
            ) : null}
            <DecisionCard
              ticketId={ticket.id}
              status={ticket.status}
              decision={ticket.decision}
              voteCount={ticket.votes.length}
              canDecide={canDecide}
            />
            <HistoryCard ticket={ticket} />
          </div>

          <div className="space-y-6">
            <StatusCard ticket={ticket} canReview={canReview} />
            <GeneralInfoCard ticket={ticket} />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
