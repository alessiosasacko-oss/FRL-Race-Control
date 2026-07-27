import {
  Activity,
  Bell,
  Bot,
  Calendar,
  CalendarRange,
  ChartNoAxesCombined,
  ClipboardCheck,
  Cog,
  Flag,
  Home,
  Layers3,
  Megaphone,
  Settings2,
  Shield,
  Trophy,
  UserCog,
  Users,
} from "lucide-react";

export const driverNavigationItems = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "Kalender", href: "/calendar", icon: Calendar },
  { name: "Rennanmeldung", href: "/attendance", icon: ClipboardCheck },
  { name: "Meisterschaft", href: "/championship", icon: Trophy },
  { name: "FIA", href: "/fia", icon: Shield },
  { name: "Benachrichtigungen", href: "/notifications", icon: Bell },
] as const;

export const leagueNavigationItems = [
  { name: "Fahrer", href: "/drivers", icon: Users },
  { name: "Teams", href: "/teams", icon: Flag },
] as const;

export const administrationNavigationItems = [
  { name: "Übersicht", href: "/admin", icon: Settings2 },
  { name: "Saisons", href: "/admin/seasons", icon: Layers3 },
  { name: "Rennen", href: "/admin/races", icon: CalendarRange },
  { name: "Ergebnisse", href: "/admin/results", icon: ChartNoAxesCombined },
  { name: "Fahrer & Rollen", href: "/admin/drivers", icon: UserCog },
  { name: "Anmeldungen", href: "/admin/attendance", icon: Activity },
  { name: "Kommunikation", href: "/admin/announcements", icon: Megaphone },
  { name: "Automationen", href: "/admin/automation", icon: Bot },
  { name: "Einstellungen", href: "/settings", icon: Cog },
] as const;

export const mainNavigationItems = [
  ...driverNavigationItems,
  ...leagueNavigationItems,
] as const;

export const mobilePrimaryItems = [
  driverNavigationItems[0],
  driverNavigationItems[1],
  driverNavigationItems[2],
  driverNavigationItems[4],
] as const;
