import type { LucideIcon } from "lucide-react";
import Link from "next/link";

type ActiveNavLinkProps = {
  href: string;
  name: string;
  icon: LucideIcon;
  active: boolean;
  compact?: boolean;
  onNavigate?: () => void;
};

export default function ActiveNavLink({
  href,
  name,
  icon: Icon,
  active,
  compact = false,
  onNavigate,
}: ActiveNavLinkProps) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`group relative flex min-h-11 items-center gap-3 rounded-md px-3 transition ${
        compact ? "py-2 text-[0.78rem]" : "py-2.5 text-[0.82rem]"
      } ${
        active
          ? "nav-link-active font-semibold"
          : "nav-link-idle"
      }`}
    >
      {active ? (
        <span className="absolute inset-y-2 left-0 w-0.5 bg-[var(--color-primary)]" />
      ) : null}
      <span
        className={`flex size-8 shrink-0 items-center justify-center rounded transition ${
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
