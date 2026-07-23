import type { FiaTicketWithRelations } from "@/domain";

type Props = {
  ticket: FiaTicketWithRelations;
};

export default function DriversCard({ ticket }: Props) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#151B24] p-6">
      <h2 className="mb-6 text-xl font-bold text-white">
        Beteiligte Fahrer
      </h2>

      <div className="space-y-4">
        {ticket.drivers.map((driver) => (
          <div
            key={driver.id}
            className="flex items-center justify-between rounded-xl bg-slate-800 p-4"
          >
            <div>
              <h3 className="font-semibold text-white">
                {driver.flag} {driver.name}
              </h3>

              <p className="text-sm text-slate-400">
                {driver.team.name}
              </p>
            </div>

            <div className="rounded-lg bg-blue-600 px-3 py-1 font-bold text-white">
              #{driver.number}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
