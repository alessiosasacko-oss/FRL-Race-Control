"use client";

import { usePathname } from "next/navigation";

const routeLabels = [
  { path: "/dashboard", title: "Dashboard", context: "Persönliche Rennzentrale" },
  { path: "/calendar", title: "Rennkalender", context: "Aktuelle Saison" },
  { path: "/attendance", title: "Rennanmeldung", context: "Teilnahmestatus" },
  { path: "/championship", title: "Meisterschaft", context: "Fahrer & Teams" },
  { path: "/fia", title: "FIA Race Control", context: "Tickets & Entscheidungen" },
  { path: "/drivers", title: "Fahrer", context: "Ligaübersicht" },
  { path: "/teams", title: "Teams", context: "Ligaübersicht" },
  { path: "/notifications", title: "Benachrichtigungen", context: "Deine Inbox" },
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
      <p className="truncate text-sm font-bold text-white sm:text-base">
        {match?.title ?? "FRL Race Control"}
      </p>
      <p className="hidden truncate text-[0.68rem] text-slate-500 sm:block">
        {match?.context ?? "Formula Realistic League"}
      </p>
    </div>
  );
}
