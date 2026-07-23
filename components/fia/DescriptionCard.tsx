import type { FiaTicketDetail } from "@/lib/fia/types";

type DescriptionCardProps = {
  ticket: FiaTicketDetail;
};

export default function DescriptionCard({
  ticket,
}: DescriptionCardProps) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-[#151B24] p-5 sm:p-6">
      <h2 className="text-xl font-bold text-white">
        Vorfallsbeschreibung
      </h2>
      <p className="mt-5 whitespace-pre-wrap leading-8 text-slate-300">
        {ticket.description}
      </p>
    </section>
  );
}
