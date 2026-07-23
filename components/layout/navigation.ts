import {
  Bell,
  Calendar,
  ClipboardCheck,
  Flag,
  Home,
  Shield,
  Trophy,
  Users,
} from "lucide-react";

export const mainNavigationItems = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "Kalender", href: "/calendar", icon: Calendar },
  { name: "Rennanmeldung", href: "/attendance", icon: ClipboardCheck },
  { name: "Meisterschaft", href: "/championship", icon: Trophy },
  { name: "Fahrer", href: "/drivers", icon: Users },
  { name: "Teams", href: "/teams", icon: Flag },
  { name: "FIA", href: "/fia", icon: Shield },
  { name: "Benachrichtigungen", href: "/notifications", icon: Bell },
] as const;
