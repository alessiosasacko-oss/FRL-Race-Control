import { Bell, Search, UserRound } from "lucide-react";
import { roleLabels } from "@/domain";
import type { AuthenticatedUser } from "@/lib/auth/session";

type TopbarProps = {
  user: AuthenticatedUser;
};

export default function Topbar({ user }: TopbarProps) {
  return (
    <header className="flex h-20 items-center justify-between border-b border-slate-800 bg-[#0F141B] px-8">

      <div>
        <h1 className="text-2xl font-bold text-white">
          Dashboard
        </h1>

        <p className="text-sm text-slate-400">
          Willkommen zurück bei FRL Race Control.
        </p>
      </div>

      <div className="flex items-center gap-4">

        <div className="flex items-center gap-2 rounded-xl bg-[#151B24] px-4 py-2">

          <Search size={18} className="text-slate-400" />

          <input
            placeholder="Suchen..."
            className="bg-transparent text-sm outline-none placeholder:text-slate-500"
          />

        </div>

        <button className="rounded-xl bg-[#151B24] p-3 transition hover:bg-blue-600">
          <Bell size={20} />
        </button>

        <div className="flex items-center gap-3 rounded-xl bg-[#151B24] px-4 py-2">
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
