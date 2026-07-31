import Image from "next/image";
import Link from "next/link";
import { Menu } from "lucide-react";
import DiscordSignInButton from "@/components/auth/DiscordSignInButton";

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between border-b border-white/10 bg-black/50 px-4 py-3 backdrop-blur-md sm:px-6 lg:px-8 lg:py-5">
      <div className="flex min-w-0 items-center gap-3">
        <Image
          src="/images/frl-logo.png"
          alt="FRL Logo"
          width={64}
          height={64}
          className="size-11 shrink-0 rounded-xl lg:size-16 lg:rounded-2xl"
        />

        <h1 className="truncate text-lg font-bold text-red-600 sm:text-xl lg:text-2xl">
          FRL Race Control
        </h1>
      </div>

      <div className="hidden items-center gap-8 lg:flex">
        <Link
          href="/"
          className="flex min-h-11 min-w-11 items-center justify-center px-1 text-gray-300 transition hover:text-white"
        >
          Home
        </Link>

        <Link
          href="/calendar"
          className="flex min-h-11 items-center px-1 text-gray-300 transition hover:text-white"
        >
          Kalender
        </Link>

        <Link
          href="/championship"
          className="flex min-h-11 items-center px-1 text-gray-300 transition hover:text-white"
        >
          Standings
        </Link>

        <Link
          href="/teams"
          className="flex min-h-11 items-center px-1 text-gray-300 transition hover:text-white"
        >
          Teams
        </Link>

        <DiscordSignInButton text="Discord Login" />
      </div>

      <details className="relative shrink-0 lg:hidden">
        <summary
          aria-label="Navigation öffnen"
          className="mobile-touch-target flex cursor-pointer list-none items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200"
        >
          <Menu size={21} />
        </summary>
        <div className="absolute right-0 top-[calc(100%+0.75rem)] w-[min(19rem,calc(100vw-2rem))] rounded-2xl border border-slate-700 bg-[#0f141b] p-3 shadow-2xl">
          <div className="grid gap-1">
            <MobileLink href="/">Home</MobileLink>
            <MobileLink href="/calendar">Kalender</MobileLink>
            <MobileLink href="/championship">Standings</MobileLink>
            <MobileLink href="/teams">Teams</MobileLink>
            <div className="mt-2 border-t border-slate-800 pt-3">
              <DiscordSignInButton text="Discord Login" />
            </div>
          </div>
        </div>
      </details>
    </nav>
  );
}

function MobileLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-11 items-center rounded-xl px-3 font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"
    >
      {children}
    </Link>
  );
}
