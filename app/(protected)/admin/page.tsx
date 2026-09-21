import Link from "next/link";
import {
  CalendarDays,
  Calculator,
  Flag,
  Layers3,
  Megaphone,
  Bot,
  Trophy,
  Users,
  ArrowUpRight,
  RadioTower,
  Landmark,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
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
    href: "/admin/users",
    title: "Benutzer & Rollen",
    description: "Systemrollen, sportliche Zuordnung und Berechtigungen",
    icon: Users,
  },
  {
    href: "/admin/teams",
    title: "Teams",
    description: "Saison, Team Principal, Farbe und Fahrerfeld",
    icon: Flag,
  },
  {
    href: "/admin/championship",
    title: "Meisterschaft",
    description: "Ergebnisse, Punktesystem und Neuberechnung",
    icon: Calculator,
  },
  {
    href: "/admin/finance",
    title: "Teamfinanzen",
    description: "Konten, Ledger, Regeln, Abrechnungen und Discord-Publishing",
    icon: Landmark,
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
      <div className="page-stack page-accent-admin">
        <PageHeader title="Control Room" eyebrow="Administration" subtitle="Operative Werkzeuge, Stammdaten und Kommunikationssysteme an einem Ort." icon={RadioTower} />
        <nav aria-label="Administrationsbereiche" className="data-table-shell">
          {areas.map((area, index) => {
            const Icon = area.icon;
            return (
              <Link
                key={area.href}
                href={area.href}
                className="group grid min-h-20 grid-cols-[2.5rem_2.75rem_minmax(0,1fr)_2.75rem] items-center gap-3 border-b border-slate-800/80 px-4 py-4 transition last:border-b-0 hover:bg-blue-500/[0.06] sm:grid-cols-[3rem_3rem_minmax(0,1fr)_auto_2.75rem] sm:px-6"
              >
                <span className="font-mono text-xs font-bold text-slate-600">{String(index + 1).padStart(2, "0")}</span>
                <span className="flex size-11 items-center justify-center border border-blue-400/20 bg-blue-500/10 text-blue-300"><Icon size={20} /></span>
                <span className="min-w-0"><span className="block font-bold uppercase tracking-[0.03em] text-white">{area.title}</span><span className="mt-1 block text-sm leading-5 text-slate-500">{area.description}</span></span>
                <span className="hidden text-[0.62rem] font-bold uppercase tracking-[0.15em] text-slate-600 sm:block">Open module</span>
                <ArrowUpRight size={18} className="justify-self-end text-slate-600 transition group-hover:text-blue-300" />
              </Link>
            );
          })}
        </nav>
      </div>
    </AppLayout>
  );
}
