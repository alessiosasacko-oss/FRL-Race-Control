import Image from "next/image";
import Link from "next/link";
import { Bell, Radio } from "lucide-react";
import GlobalSearch from "@/components/search/GlobalSearch";
import { roleLabels } from "@/domain";
import type { AuthenticatedUser } from "@/lib/auth/session";
import RouteContext from "./RouteContext";

type TopbarProps = {
  user: AuthenticatedUser;
  unreadNotifications: number;
};

export default function Topbar({
  user,
  unreadNotifications,
}: TopbarProps) {
  return (
    <header className="app-topbar sticky top-0 z-40 flex min-h-16 min-w-0 items-center justify-between gap-2 border-b px-3 py-3 backdrop-blur-xl sm:gap-3 sm:px-6 lg:px-8">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <Image
          src="/images/frl-logo.png"
          alt=""
          width={36}
          height={36}
          className="rounded-lg lg:hidden"
        />
        <RouteContext />
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <span className="hidden items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-cyan-300 xl:flex">
          <Radio size={13} />
          System online
        </span>
        <GlobalSearch />
        <Link
          href="/notifications"
          aria-label="Benachrichtigungen öffnen"
          className="topbar-action relative flex size-11 items-center justify-center rounded-xl border transition"
        >
          <Bell size={19} />
          {unreadNotifications > 0 ? (
            <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full border-2 border-[#080d14] bg-red-500 px-1 text-[9px] font-bold text-white">
              {unreadNotifications > 99 ? "99+" : unreadNotifications}
            </span>
          ) : null}
        </Link>
        <Link
          href="/profile"
          aria-label="Profil öffnen"
          className="topbar-action flex size-11 shrink-0 items-center justify-center gap-3 rounded-xl border p-1.5 transition lg:min-h-11 lg:w-auto lg:px-2.5 lg:py-1.5"
        >
          {user.avatarUrl ? (
            <Image
              src={user.avatarUrl}
              alt=""
              width={32}
              height={32}
              className="size-8 rounded-lg object-cover"
            />
          ) : (
            <span className="flex size-8 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold">
              {user.displayName.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="hidden min-w-0 lg:block">
            <span className="block max-w-36 truncate text-xs font-semibold text-white">
              {user.displayName}
            </span>
            <span className="block max-w-36 truncate text-[0.65rem] text-violet-300">
              {roleLabels[user.roles[0]]}
            </span>
          </span>
        </Link>
      </div>
    </header>
  );
}
