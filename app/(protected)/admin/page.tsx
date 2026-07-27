import Link from "next/link";
import {
  CalendarDays,
  Calculator,
  ClipboardCheck,
  Flag,
  Layers3,
  Megaphone,
  Bot,
  Trophy,
  Users,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { Permission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";

const areas = [
  {
    href: "/admin/leagues",
    title: "Ligen & Rennzeiten",
    description: "F1 bis F6, Wochentage, Startzeiten und Fristen",
    icon: Trophy,
  },
  {
    href: "/admin/seasons",
    title: "Saisons",
    description: "Zeiträume, aktive Saisons und Archivierung",
    icon: Layers3,
  },
  {
    href: "/admin/races",
    title: "Rennkalender",
    description: "Gemeinsame Rennwochenenden und automatische Liga-Termine",
    icon: CalendarDays,
  },
  {
    href: "/admin/drivers",
    title: "Fahrer",
    description: "Startnummern, Discord, Liga und Team",
    icon: Users,
  },
  {
    href: "/admin/teams",
    title: "Teams",
    description: "Saison, Team Principal, Farbe und Fahrerfeld",
    icon: Flag,
  },
  {
    href: "/admin/attendance",
    title: "Rennanmeldung",
    description: "Teilnahme, Teamchef-Eingriffe, Fristen und Audit-Historie",
    icon: ClipboardCheck,
  },
  {
    href: "/admin/championship",
    title: "Meisterschaft",
    description: "Ergebnisse, Punktesystem und Neuberechnung",
    icon: Calculator,
  },
  {
    href: "/admin/automation",
    title: "Automation & Discord",
    description: "Bot, Warteschlangen, Rollen, Kanäle und geplante Jobs",
    icon: Bot,
  },
  {
    href: "/admin/announcements",
    title: "Kommunikation",
    description: "Plattformweite Mitteilungen und E-Mail-Auslösung",
    icon: Megaphone,
  },
];

export default async function AdminPage() {
  await requirePermission(Permission.ManageMasterData);

  return (
    <AppLayout>
      <div>
        <h1 className="text-3xl font-bold text-white">
          Stammdatenverwaltung
        </h1>
        <p className="mt-2 text-slate-400">
          Zentrale Verwaltung der sportlichen Grundlage von FRL Race Control.
        </p>
        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {areas.map((area) => {
            const Icon = area.icon;
            return (
              <Link
                key={area.href}
                href={area.href}
                className="master-card group transition hover:-translate-y-1 hover:border-blue-500"
              >
                <div className="inline-flex rounded-xl bg-blue-600 p-3">
                  <Icon size={24} />
                </div>
                <h2 className="mt-5 text-xl font-semibold text-white">
                  {area.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {area.description}
                </p>
              </Link>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
