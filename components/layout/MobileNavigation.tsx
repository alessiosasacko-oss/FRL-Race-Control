"use client";

import type { LucideIcon } from "lucide-react";
import { Menu, Settings, UserRound, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { roleLabels } from "@/domain";
import type { AuthenticatedUser } from "@/lib/auth/session";
import ActiveNavLink from "./ActiveNavLink";
import {
  administrationNavigationItems,
  driverNavigationItems,
  leagueNavigationItems,
  mobilePrimaryItems,
} from "./navigation";

type MobileNavigationProps = {
  user: AuthenticatedUser;
  canManageAdministration: boolean;
};

type NavigationItem = {
  name: string;
  href: string;
  icon: LucideIcon;
};

function isCurrent(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function MobileNavigation({
  user,
  canManageAdministration,
}: MobileNavigationProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  return (
    <>
      <nav
        aria-label="Mobile Hauptnavigation"
        className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-slate-700/80 bg-[#0b1119]/95 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-18px_45px_rgba(0,0,0,0.35)] backdrop-blur-xl lg:hidden"
      >
        {mobilePrimaryItems.map((item) => {
          const Icon = item.icon;
          const active = isCurrent(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-[0.66rem] font-semibold transition ${
                active ? "text-blue-300" : "text-slate-500"
              }`}
            >
              <span
                className={`flex h-7 min-w-10 items-center justify-center rounded-full ${
                  active ? "bg-blue-500/20" : ""
                }`}
              >
                <Icon size={19} />
              </span>
              {item.name === "Rennanmeldung" ? "Anmeldung" : item.name}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="mobile-navigation-drawer"
          className="flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-[0.66rem] font-semibold text-slate-500"
        >
          <span className="flex h-7 min-w-10 items-center justify-center rounded-full">
            <Menu size={20} />
          </span>
          Mehr
        </button>
      </nav>

      {open ? (
        <div
          className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm lg:hidden"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setOpen(false);
          }}
        >
          <aside
            id="mobile-navigation-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Alle Bereiche"
            className="absolute inset-y-0 right-0 flex w-[min(90vw,23rem)] flex-col border-l border-slate-700 bg-[#0b1119] shadow-2xl"
          >
            <header className="flex items-center justify-between border-b border-slate-800 p-5">
              <div className="flex items-center gap-3">
                <Image
                  src="/images/frl-logo.png"
                  alt=""
                  width={40}
                  height={40}
                  className="rounded-xl"
                />
                <div>
                  <p className="font-bold text-white">FRL Race Control</p>
                  <p className="text-xs text-slate-500">Alle Bereiche</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Navigation schließen"
                className="flex size-11 items-center justify-center rounded-xl border border-slate-700 text-slate-300"
              >
                <X size={20} />
              </button>
            </header>

            <div className="flex-1 space-y-6 overflow-y-auto p-4">
              <NavigationGroup
                label="Fahrer"
                items={driverNavigationItems}
                onNavigate={() => setOpen(false)}
              />
              <NavigationGroup
                label="Liga"
                items={leagueNavigationItems}
                onNavigate={() => setOpen(false)}
              />
              {canManageAdministration ? (
                <NavigationGroup
                  label="Administration"
                  items={administrationNavigationItems}
                  compact
                  onNavigate={() => setOpen(false)}
                />
              ) : null}
            </div>

            <div className="border-t border-slate-800 p-4">
              <Link
                href="/profile"
                onClick={() => setOpen(false)}
                className="flex min-h-14 items-center gap-3 rounded-xl bg-slate-900/70 p-3"
              >
                {user.avatarUrl ? (
                  <Image
                    src={user.avatarUrl}
                    alt=""
                    width={40}
                    height={40}
                    className="size-10 rounded-xl object-cover"
                  />
                ) : (
                  <span className="flex size-10 items-center justify-center rounded-xl bg-blue-600">
                    <UserRound size={19} />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-white">
                    {user.displayName}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {user.roles.map((role) => roleLabels[role]).join(" · ")}
                  </span>
                </span>
                <Settings size={17} className="text-slate-500" />
              </Link>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}

function NavigationGroup({
  label,
  items,
  compact = false,
  onNavigate,
}: {
  label: string;
  items: ReadonlyArray<NavigationItem>;
  compact?: boolean;
  onNavigate: () => void;
}) {
  return (
    <section>
      <p className="mb-2 px-3 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-slate-600">
        {label}
      </p>
      <div className="space-y-1">
        {items.map((item) => (
          <ActiveNavLink
            key={item.href}
            {...item}
            compact={compact}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </section>
  );
}
