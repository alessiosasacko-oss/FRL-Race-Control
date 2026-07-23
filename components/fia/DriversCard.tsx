import type { FiaTicketDetail } from "@/lib/fia/types";

type DriversCardProps = {
  ticket: FiaTicketDetail;
};

export default function DriversCard({ ticket }: DriversCardProps) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-[#151B24] p-5 sm:p-6">
      <h2 className="text-xl font-bold text-white">Beteiligte Fahrer</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {ticket.drivers.map((driver) => (
          <div
            key={driver.id}
            className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-4"
          >
            <div>
              <h3 className="font-semibold text-white">
                {driver.flag} {driver.name}
              </h3>
              <p className="text-sm text-slate-400">
                {driver.team?.name ?? "Ohne Team"}
              </p>
            </div>
            <div className="rounded-lg bg-blue-600 px-3 py-1 font-bold text-white">
              #{driver.number}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
