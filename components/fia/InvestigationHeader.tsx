import type { Ticket } from "@/types/fia";

type Props = {
  ticket: Ticket;
};

export default function InvestigationHeader({ ticket }: Props) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#151B24] p-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-widest text-slate-500">
            FIA Investigation
          </p>

          <h1 className="mt-2 text-4xl font-bold text-white">
            {ticket.title}
          </h1>

          <p className="mt-2 text-slate-400">
            Ticket #{ticket.id}
          </p>
        </div>

        <div className="rounded-xl bg-red-600 px-5 py-2 font-semibold text-white">
          {ticket.status}
        </div>
      </div>
    </div>
  );
}
