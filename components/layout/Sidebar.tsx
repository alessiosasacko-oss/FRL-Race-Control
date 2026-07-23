import Image from "next/image";
import Link from "next/link";
import {
  Home,
  Calendar,
  ClipboardCheck,
  Trophy,
  Users,
  Flag,
  Shield,
  Bell,
  User,
  Settings,
  LogOut,
} from "lucide-react";
import { roleLabels } from "@/domain";
import { signOutCurrentUser } from "@/lib/auth/actions";
import {
  hasPermission,
  Permission,
} from "@/lib/auth/permissions";
import type { AuthenticatedUser } from "@/lib/auth/session";

const menuItems = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "Kalender", href: "/calendar", icon: Calendar },
  { name: "Rennanmeldung", href: "/attendance", icon: ClipboardCheck },
  { name: "Meisterschaft", href: "/championship", icon: Trophy },
  { name: "Fahrer", href: "/drivers", icon: Users },
  { name: "Teams", href: "/teams", icon: Flag },
  { name: "FIA", href: "/fia", icon: Shield },
  { name: "Benachrichtigungen", href: "/notifications", icon: Bell },
];

type SidebarProps = {
  user: AuthenticatedUser;
};

export default function Sidebar({ user }: SidebarProps) {
  const canManageAdministration = hasPermission(
    user.roles,
    Permission.ManageAdministration,
  );

  return (
    <aside className="flex h-screen w-72 flex-col border-r border-slate-800 bg-[#0F141B]">

      {/* Logo */}
      <div className="border-b border-slate-800 px-6 py-6">

        <div className="flex items-center gap-3">

          <Image
            src="/images/frl-logo.png"
            alt="FRL"
            width={48}
            height={48}
          />

          <div>
            <h1 className="text-lg font-bold text-white">
              FRL Race Control
            </h1>

            <p className="text-xs text-slate-400">
              Formula Realistic League
            </p>
          </div>

        </div>

      </div>

      {/* Menü */}

      <nav className="flex-1 px-4 py-5 space-y-2">

        {menuItems.map((item) => {

          const Icon = item.icon;

          return (

            <Link
              key={item.name}
              href={item.href}
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-slate-300 transition-all hover:bg-blue-600 hover:text-white"
            >

              <Icon size={20} />

              <span>{item.name}</span>

            </Link>

          );

        })}

      </nav>

      {/* Profil */}

      <div className="border-t border-slate-800 p-4">

        <div className="rounded-xl bg-[#151B24] p-4">

          <div className="flex items-center gap-3">

            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600">

              <User size={22} />

            </div>

            <div>

              <h3 className="font-semibold text-white">
                {user.displayName}
              </h3>

              <p className="text-xs text-slate-400">
                {user.roles.map((role) => roleLabels[role]).join(" • ")}
              </p>

            </div>

          </div>

          <Link
            href="/profile"
            className="mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-700"
          >
            <User size={18} />
            Profil
          </Link>

          {canManageAdministration ? (
            <Link
              href="/admin"
              className="mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-700"
            >
              <Settings size={18} />
              Administration
            </Link>
          ) : null}

          <form action={signOutCurrentUser}>
            <button
              type="submit"
              className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-700"
            >
              <LogOut size={18} />
              Abmelden
            </button>
          </form>

        </div>

      </div>

    </aside>
  );
}
