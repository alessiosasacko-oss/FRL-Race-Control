import Link from "next/link";
import { Bell, Menu, Search, UserRound } from "lucide-react";
import { roleLabels } from "@/domain";
import type { AuthenticatedUser } from "@/lib/auth/session";
import { mainNavigationItems } from "./navigation";

type TopbarProps = {
  user: AuthenticatedUser;
};

export default function Topbar({ user }: TopbarProps) {
  return (
    <header className="flex min-h-20 items-center justify-between gap-4 border-b border-slate-800 bg-[#0F141B] px-4 py-4 sm:px-6 lg:px-8">

      <div>
        <h1 className="text-xl font-bold text-white sm:text-2xl">
          FRL Race Control
        </h1>

        <p className="text-sm text-slate-400">
          Willkommen zurück bei FRL Race Control.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <details className="relative lg:hidden">
          <summary
            aria-label="Navigation öffnen"
            className="flex cursor-pointer list-none rounded-xl bg-[#151B24] p-3 transition hover:bg-blue-600"
          >
            <Menu size={20} />
          </summary>
          <nav className="absolute right-0 top-14 z-50 w-64 rounded-2xl border border-slate-700 bg-[#0F141B] p-3 shadow-2xl">
            {mainNavigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-300 transition hover:bg-blue-600 hover:text-white"
                >
                  <Icon size={18} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </details>

        <div className="hidden items-center gap-2 rounded-xl bg-[#151B24] px-4 py-2 xl:flex">

          <Search size={18} className="text-slate-400" />

          <input
            placeholder="Suchen..."
            className="bg-transparent text-sm outline-none placeholder:text-slate-500"
          />

        </div>

        <Link
          href="/notifications"
          aria-label="Benachrichtigungen öffnen"
          className="rounded-xl bg-[#151B24] p-3 transition hover:bg-blue-600"
        >
          <Bell size={20} />
        </Link>

        <div className="hidden items-center gap-3 rounded-xl bg-[#151B24] px-4 py-2 sm:flex">
          <UserRound size={20} className="text-blue-400" />
          <div>
            <p className="text-sm font-semibold text-white">
              {user.displayName}
            </p>
            <p className="text-xs text-slate-400">
              {roleLabels[user.roles[0]]}
            </p>
          </div>
        </div>

      </div>

    </header>
  );
}
