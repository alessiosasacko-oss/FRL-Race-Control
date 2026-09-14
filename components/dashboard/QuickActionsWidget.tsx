import Link from "next/link";
import {
  CalendarDays,
  Bell,
  Flag,
  ListOrdered,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import DashboardCard from "./DashboardCard";

const actions = [
  { href: "/calendar", label: "Kalender", icon: CalendarDays },
  { href: "/championship", label: "Meisterschaft", icon: Trophy },
  { href: "/results", label: "Ergebnisse", icon: ListOrdered },
  { href: "/teams", label: "Teams", icon: Flag },
  { href: "/drivers", label: "Fahrer", icon: Users },
  { href: "/notifications", label: "Hinweise", icon: Bell },
] as const;

export default function QuickActionsWidget() {
  return (
    <DashboardCard icon={Zap} title="Schnellzugriff">
      <div className="grid grid-cols-2 gap-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className="flex flex-col items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/30 p-4 text-sm font-medium text-slate-300 transition hover:-translate-y-0.5 hover:border-blue-500 hover:text-white"
            >
              <Icon size={20} className="text-blue-400" />
              {action.label}
            </Link>
          );
        })}
      </div>
    </DashboardCard>
  );
}
