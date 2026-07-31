"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type ActiveNavLinkProps = {
  href: string;
  name: string;
  icon: LucideIcon;
  compact?: boolean;
  onNavigate?: () => void;
};

function matchesPath(pathname: string, href: string): boolean {
  if (href === "/dashboard" || href === "/admin") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function ActiveNavLink({
  href,
  name,
  icon: Icon,
  compact = false,
  onNavigate,
}: ActiveNavLinkProps) {
  const pathname = usePathname();
  const active = matchesPath(pathname, href);

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`group relative flex min-h-11 items-center gap-3 rounded-xl px-3 transition ${
        compact ? "py-2 text-[0.82rem]" : "py-2.5 text-sm"
      } ${
        active
          ? "nav-link-active font-semibold"
          : "nav-link-idle"
      }`}
    >
      {active ? (
        <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[var(--color-primary)] shadow-[0_0_16px_var(--color-primary)]" />
      ) : null}
      <span
        className={`flex size-8 shrink-0 items-center justify-center rounded-lg transition ${
          active
            ? "nav-icon-active"
            : "nav-icon-idle"
        }`}
      >
        <Icon size={compact ? 17 : 18} aria-hidden="true" />
      </span>
      <span className="truncate">{name}</span>
    </Link>
  );
}
