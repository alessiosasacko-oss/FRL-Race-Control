import { ClipboardList, CircleAlert } from "lucide-react";

export default function TasksCard() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#151B24] p-6 transition hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/10">

      <div className="mb-5 flex items-center gap-3">

        <div className="rounded-xl bg-orange-500 p-3">
          <ClipboardList size={22} />
        </div>

        <div>
          <h2 className="text-lg font-semibold">
            Aufgaben
          </h2>

          <p className="text-sm text-slate-400">
            Deine offenen Aufgaben
          </p>
        </div>

      </div>

      <div className="space-y-4">

        <div className="flex items-center justify-between rounded-xl bg-[#0F141B] p-4">
          <div>
            <p className="font-medium">
              Rennanmeldung Monza
            </p>

            <p className="text-sm text-slate-400">
              Bis Samstag 18:00 Uhr
            </p>
          </div>

          <CircleAlert className="text-orange-400" size={20} />
        </div>

        <div className="flex items-center justify-between rounded-xl bg-[#0F141B] p-4">
          <div>
            <p className="font-medium">
              Stellungnahme Ticket #24
            </p>

            <p className="text-sm text-slate-400">
              Bis heute 22:00 Uhr
            </p>
          </div>

          <CircleAlert className="text-red-500" size={20} />
        </div>

      </div>

    </div>
  );
}