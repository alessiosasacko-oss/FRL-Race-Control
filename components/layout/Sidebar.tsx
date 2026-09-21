"use client";

import Image from "next/image";
import Link from "next/link";
import { Crown, LogOut, PanelLeftClose, PanelLeftOpen, Settings, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { roleLabels } from "@/domain";
import { signOutCurrentUser } from "@/lib/auth/actions";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import type { AuthenticatedUser } from "@/lib/auth/session";
import type { NavigationSettings } from "@/lib/design/theme";
import { useState } from "react";
import { usePathname } from "next/navigation";
import ActiveNavLink from "./ActiveNavLink";
import {
  administrationNavigationItems,
  driverNavigationItems,
  leagueNavigationItems,
} from "./navigation";

type SidebarProps = {
  user: AuthenticatedUser;
  settings: NavigationSettings;
};

type NavigationItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  permission: Permission;
};

export default function Sidebar({ user, settings }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const canManageAdministration = hasPermission(
    user.roles,
    Permission.ManageAdministration,
  );

  return (
    <aside data-collapsed={collapsed ? "true" : "false"} className="app-sidebar sticky top-0 hidden h-screen w-[16rem] shrink-0 flex-col border-r transition-[width] lg:flex">
      <div className="border-b border-white/8 px-4 py-4">
        <div className="flex items-center gap-3">
          <Image
            src="/images/frl-logo.png"
            alt="FRL"
            width={settings.logoSize === "SMALL" ? 36 : settings.logoSize === "LARGE" ? 52 : 44}
            height={settings.logoSize === "SMALL" ? 36 : settings.logoSize === "LARGE" ? 52 : 44}
            className="rounded-md"
          />
          <div className="sidebar-copy min-w-0">
            <h1 className="truncate text-sm font-black uppercase tracking-[0.08em] text-white">FRL // RC</h1>
            <p className="mt-1 text-[0.58rem] font-bold uppercase tracking-[0.22em] text-slate-500">Pit Wall System</p>
          </div>
          {settings.collapsible ? (
            <button type="button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Sidebar ausklappen" : "Sidebar einklappen"} className="ml-auto flex size-11 shrink-0 items-center justify-center rounded-md text-[var(--color-text-muted)] transition hover:bg-[var(--color-card)] hover:text-[var(--color-text)]">
              {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
          ) : null}
        </div>
      </div>

      <div className="sidebar-copy flex items-center gap-2 border-b border-white/8 px-5 py-3 text-[0.6rem] font-bold uppercase tracking-[0.2em] text-emerald-300">
        <span className="size-1.5 bg-emerald-400" /> System live
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        <SidebarGroup pathname={pathname} label="Race" items={driverNavigationItems.filter((item) => hasPermission(user.roles, item.permission))} />
        <SidebarGroup pathname={pathname} label="Paddock" items={leagueNavigationItems.filter((item) => hasPermission(user.roles, item.permission))} />
        {canManageAdministration ? (
          <SidebarGroup
            pathname={pathname}
            label="Control"
            items={administrationNavigationItems.filter((item) => hasPermission(user.roles, item.permission))}
            compact
            special
          />
        ) : null}
      </nav>

      <div className="sidebar-profile border-t border-white/8 p-3">
        <div className="nav-profile-card rounded-md border p-3">
          <div className="flex items-center gap-3">
            {user.avatarUrl ? (
              <Image
                src={user.avatarUrl}
                alt=""
                width={44}
                height={44}
                className="size-11 rounded object-cover"
              />
            ) : (
              <div className="flex size-11 items-center justify-center rounded bg-blue-600">
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
  pathname,
  label,
  items,
  compact = false,
  special = false,
}: {
  pathname: string;
  label: string;
  items: ReadonlyArray<NavigationItem>;
  compact?: boolean;
  special?: boolean;
}) {
  return (
    <section>
      <div className="sidebar-group-label mb-2 flex items-center gap-2 px-3">
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
          <ActiveNavLink
            key={item.href}
            {...item}
            active={item.href === "/dashboard" || item.href === "/admin" ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`)}
            compact={compact}
          />
        ))}
      </div>
    </section>
  );
}
