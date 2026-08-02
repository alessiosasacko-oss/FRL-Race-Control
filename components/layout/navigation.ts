import {
  Activity,
  Bell,
  Bot,
  Calendar,
  CalendarRange,
  ChartNoAxesCombined,
  ClipboardCheck,
  Clock3,
  Cog,
  Flag,
  Home,
  Layers3,
  Megaphone,
  Map,
  Palette,
  Settings2,
  Shield,
  Trophy,
  UserCog,
  Users,
} from "lucide-react";
import { Permission } from "@/lib/auth/permissions";

export const driverNavigationItems = [
  { name: "Dashboard", href: "/dashboard", icon: Home, permission: Permission.ViewRaceControl },
  { name: "Kalender", href: "/calendar", icon: Calendar, permission: Permission.ViewMasterData },
  { name: "Rennanmeldung", href: "/attendance", icon: ClipboardCheck, permission: Permission.ViewChampionship },
  { name: "Meisterschaft", href: "/championship", icon: Trophy, permission: Permission.ViewChampionship },
  { name: "FIA", href: "/fia", icon: Shield, permission: Permission.ViewRaceControl },
  { name: "Benachrichtigungen", href: "/notifications", icon: Bell, permission: Permission.ViewRaceControl },
] as const;

export const leagueNavigationItems = [
  { name: "Fahrer", href: "/drivers", icon: Users, permission: Permission.ViewMasterData },
  { name: "Teams", href: "/teams", icon: Flag, permission: Permission.ViewMasterData },
] as const;

export const administrationNavigationItems = [
  { name: "Übersicht", href: "/admin", icon: Settings2, permission: Permission.ManageAdministration },
  {
    name: "Ligen & Rennzeiten",
    href: "/admin/leagues",
    icon: Clock3,
    permission: Permission.ManageMasterData,
  },
  { name: "Saisons", href: "/admin/seasons", icon: Layers3, permission: Permission.ManageMasterData },
  { name: "Rennen", href: "/admin/races", icon: CalendarRange, permission: Permission.ManageMasterData },
  { name: "Ergebnisse", href: "/admin/results", icon: ChartNoAxesCombined, permission: Permission.ManageResults },
  { name: "Fahrer", href: "/admin/drivers", icon: UserCog, permission: Permission.ManageMasterData },
  { name: "Benutzer & Rollen", href: "/admin/users", icon: Users, permission: Permission.ManageUsers },
  { name: "Anmeldungen", href: "/admin/attendance", icon: Activity, permission: Permission.ManageAttendance },
  { name: "Kommunikation", href: "/admin/announcements", icon: Megaphone, permission: Permission.ManageAdministration },
  { name: "Automationen", href: "/admin/automation", icon: Bot, permission: Permission.ManageAutomation },
  { name: "Design & Branding", href: "/admin/design", icon: Palette, permission: Permission.ManageBranding },
  { name: "Fahrer-Rennanzüge", href: "/admin/design/driver-suits", icon: Palette, permission: Permission.ManageBranding },
  { name: "Strecken", href: "/admin/tracks", icon: Map, permission: Permission.ManageMasterData },
  { name: "Einstellungen", href: "/settings", icon: Cog, permission: Permission.ViewRaceControl },
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
