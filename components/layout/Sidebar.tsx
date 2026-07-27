"use client";

import Image from "next/image";
import Link from "next/link";
import { Crown, LogOut, Settings, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { roleLabels } from "@/domain";
import { signOutCurrentUser } from "@/lib/auth/actions";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import type { AuthenticatedUser } from "@/lib/auth/session";
import ActiveNavLink from "./ActiveNavLink";
import {
  administrationNavigationItems,
  driverNavigationItems,
  leagueNavigationItems,
} from "./navigation";

type SidebarProps = {
  user: AuthenticatedUser;
};

type NavigationItem = {
  name: string;
  href: string;
  icon: LucideIcon;
};

export default function Sidebar({ user }: SidebarProps) {
  const canManageAdministration = hasPermission(
    user.roles,
    Permission.ManageAdministration,
  );

  return (
    <aside className="sticky top-0 hidden h-screen w-[17.5rem] shrink-0 flex-col border-r border-slate-800/90 bg-[#0b1119]/95 lg:flex">
      <div className="border-b border-slate-800/80 px-5 py-5">
        <div className="flex items-center gap-3">
          <Image
            src="/images/frl-logo.png"
            alt="FRL"
            width={44}
            height={44}
            className="rounded-xl shadow-lg shadow-blue-950/30"
          />
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold text-white">
              FRL Race Control
            </h1>
            <p className="mt-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.13em] text-blue-400">
              Control Center
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        <SidebarGroup label="Fahrer" items={driverNavigationItems} />
        <SidebarGroup label="Liga" items={leagueNavigationItems} />
        {canManageAdministration ? (
          <SidebarGroup
            label="Administration"
            items={administrationNavigationItems}
            compact
            special
          />
        ) : null}
      </nav>

      <div className="border-t border-slate-800/80 p-3">
        <div className="rounded-2xl border border-slate-800 bg-[#101720] p-3">
          <div className="flex items-center gap-3">
            {user.avatarUrl ? (
              <Image
                src={user.avatarUrl}
                alt=""
                width={44}
                height={44}
                className="size-11 rounded-xl object-cover"
              />
            ) : (
              <div className="flex size-11 items-center justify-center rounded-xl bg-blue-600">
                <User size={20} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-semibold text-white">
                {user.displayName}
              </h3>
              <p className="mt-0.5 truncate text-[0.68rem] text-violet-300">
                {user.roles.map((role) => roleLabels[role]).join(" · ")}
              </p>
            </div>
          </div>
          <Link
            href="/profile"
            className="mt-3 flex min-h-10 items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <User size={16} />
            Profil
          </Link>
          <Link
            href="/settings"
            className="flex min-h-10 items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <Settings size={16} />
            Einstellungen
          </Link>
          <form action={signOutCurrentUser}>
            <button
              type="submit"
              className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-slate-400 transition hover:bg-red-500/10 hover:text-red-300"
            >
              <LogOut size={16} />
              Abmelden
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}

function SidebarGroup({
  label,
  items,
  compact = false,
  special = false,
}: {
  label: string;
  items: ReadonlyArray<NavigationItem>;
  compact?: boolean;
  special?: boolean;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2 px-3">
        {special ? <Crown size={12} className="text-violet-400" /> : null}
        <p
          className={`text-[0.62rem] font-bold uppercase tracking-[0.18em] ${
            special ? "text-violet-400" : "text-slate-600"
          }`}
        >
          {label}
        </p>
      </div>
      <div className="space-y-0.5">
        {items.map((item) => (
          <ActiveNavLink key={item.href} {...item} compact={compact} />
        ))}
      </div>
    </section>
  );
}
