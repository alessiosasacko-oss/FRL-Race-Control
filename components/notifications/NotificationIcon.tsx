import {
  Bell,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  ClipboardCheck,
  Flag,
  Gavel,
  Megaphone,
  ShieldAlert,
  Trophy,
} from "lucide-react";
import { NotificationType } from "@/domain";

const icons = {
  [NotificationType.System]: Bell,
  [NotificationType.RaceReminder]: CalendarClock,
  [NotificationType.Attendance]: ClipboardCheck,
  [NotificationType.FiaTicket]: ShieldAlert,
  [NotificationType.FiaDecision]: Gavel,
  [NotificationType.Championship]: Trophy,
  [NotificationType.Penalty]: Gavel,
  [NotificationType.QualifyingBan]: ShieldAlert,
  [NotificationType.RaceBan]: ShieldAlert,
  [NotificationType.AttendanceOpen]: ClipboardCheck,
  [NotificationType.AttendanceClosingSoon]: CalendarClock,
  [NotificationType.AttendanceClosed]: CheckCircle2,
  [NotificationType.RaceResult]: Flag,
  [NotificationType.ChampionshipUpdated]: Trophy,
  [NotificationType.NewSeason]: CalendarPlus,
  [NotificationType.NewRace]: Flag,
  [NotificationType.AdminAnnouncement]: Megaphone,
} satisfies Record<NotificationType, typeof Bell>;

export default function NotificationIcon({
  type,
  size = 20,
}: {
  type: NotificationType;
  size?: number;
}) {
  const Icon = icons[type];
  return <Icon size={size} />;
}
