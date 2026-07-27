import type { FiaTicketDetail } from "@/lib/fia/types";

type DriversCardProps = {
  ticket: FiaTicketDetail;
};

export default function DriversCard({ ticket }: DriversCardProps) {
  return (
    <section className="border-t border-slate-800 pt-5">
      <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-400">
        Beteiligte Fahrer
      </h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        {ticket.drivers.map((driver) => (
          <div
            key={driver.id}
            className="flex items-center justify-between rounded-xl bg-slate-900/70 p-3"
          >
            <div>
              <h3 className="font-semibold text-white">
                {driver.flag} {driver.name}
              </h3>
              <p className="text-sm text-slate-400">
                {driver.team?.name ?? "Ohne Team"}
              </p>
            </div>
            <div className="rounded-lg bg-blue-500/15 px-2.5 py-1 font-bold text-blue-200">
              #{driver.number}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
