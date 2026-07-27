import type { FiaTicketDetail } from "@/lib/fia/types";

type DescriptionCardProps = {
  ticket: FiaTicketDetail;
};

export default function DescriptionCard({
  ticket,
}: DescriptionCardProps) {
  return (
    <section className="border-t border-slate-800 pt-5">
      <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-400">
        Vorfallsbeschreibung
      </h2>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">
        {ticket.description}
      </p>
    </section>
  );
}
