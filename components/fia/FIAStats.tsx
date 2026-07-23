import { tickets } from "@/lib/data/tickets";
import {
  AlertTriangle,
  Clock3,
  CheckCircle2,
  Scale,
} from "lucide-react";

export default function FIAStats() {
  const open = tickets.filter((t) => t.status === "Offen").length;
  const working = tickets.filter(
    (t) => t.status === "In Bearbeitung"
  ).length;
  const finished = tickets.filter((t) => t.status === "Erledigt").length;
  const total = tickets.length || 1;

  const stats = [
    {
      title: "Offene Fälle",
      value: open,
      color: "bg-red-500",
      icon: AlertTriangle,
      progress: (open / total) * 100,
    },
    {
      title: "In Bearbeitung",
      value: working,
      color: "bg-yellow-500",
      icon: Clock3,
      progress: (working / total) * 100,
    },
    {
      title: "Abgeschlossen",
      value: finished,
      color: "bg-green-500",
      icon: CheckCircle2,
      progress: (finished / total) * 100,
    },
    {
      title: "Gesamt",
      value: total,
      color: "bg-blue-500",
      icon: Scale,
      progress: 100,
    },
  ];

  return (
    <div className="mb-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;

        return (
          <div
            key={stat.title}
            className="rounded-2xl border border-slate-800 bg-[#151B24] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-blue-500/50 hover:shadow-xl hover:shadow-blue-500/10"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">{stat.title}</p>

                <h2 className="mt-2 text-4xl font-black text-white">
                  {stat.value}
                </h2>
              </div>

              <div className="rounded-xl bg-slate-900 p-3">
                <Icon size={24} className="text-blue-400" />
              </div>
            </div>

            <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-800">
              <div
                className={`${stat.color} h-full rounded-full transition-all duration-700`}
                style={{ width: `${stat.progress}%` }}
              />
            </div>

            <p className="mt-3 text-xs uppercase tracking-wider text-slate-500">
              {Math.round(stat.progress)}% aller Tickets
            </p>
          </div>
        );
      })}
    </div>
  );
}