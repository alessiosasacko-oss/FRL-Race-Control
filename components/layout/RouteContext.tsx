"use client";

import { usePathname } from "next/navigation";

const routeLabels = [
  { path: "/dashboard", title: "Dashboard", context: "Persönliche Rennzentrale" },
  { path: "/calendar", title: "Rennkalender", context: "Aktuelle Saison" },
  { path: "/championship", title: "Meisterschaft", context: "Fahrer & Teams" },
  { path: "/results", title: "Ergebnisse", context: "Offizielle Klassifikationen" },
  { path: "/drivers", title: "Fahrer", context: "Ligaübersicht" },
  { path: "/teams", title: "Teams", context: "Ligaübersicht" },
  { path: "/notifications", title: "Benachrichtigungen", context: "Deine Inbox" },
  { path: "/admin/design", title: "Design & Branding", context: "Globale Markensteuerung" },
  { path: "/admin/design/driver-suits", title: "Fahrer-Rennanzüge", context: "Teamgebundene Charakter-Designs" },
  { path: "/admin/tracks", title: "Strecken", context: "Layouts & Rennstreckendaten" },
  { path: "/admin/users", title: "Benutzer & Rollen", context: "Zugriffe & sportliche Zuordnung" },
  { path: "/admin", title: "Administration", context: "Race-Control-Werkzeuge" },
  { path: "/profile", title: "Profil", context: "Fahreridentität" },
  { path: "/settings", title: "Einstellungen", context: "Konto & Präferenzen" },
] as const;

export default function RouteContext() {
  const pathname = usePathname();
  const match = routeLabels.find(
    (route) => pathname === route.path || pathname.startsWith(`${route.path}/`),
  );

  return (
    <div className="min-w-0">
      <p className="truncate text-xs font-black uppercase tracking-[0.08em] text-white sm:text-sm">
        {match?.title ?? "FRL Race Control"}
      </p>
      <p className="mt-0.5 hidden truncate text-[0.62rem] uppercase tracking-[0.12em] text-slate-600 sm:block">
        {match?.context ?? "Formula Realistic League"}
      </p>
    </div>
  );
}
