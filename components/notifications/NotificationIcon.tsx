import { Bell, CalendarClock, CalendarPlus, Flag, Gavel, Megaphone, Trophy } from "lucide-react";
import { NotificationType } from "@/domain";

export default function NotificationIcon({ type, size = 20 }: { type: NotificationType; size?: number }) {
  const Icon = type === NotificationType.RaceReminder
    ? CalendarClock
    : type === NotificationType.Championship || type === NotificationType.ChampionshipUpdated
      ? Trophy
      : type === NotificationType.Penalty || type === NotificationType.QualifyingBan || type === NotificationType.RaceBan
        ? Gavel
        : type === NotificationType.NewSeason
          ? CalendarPlus
          : type === NotificationType.RaceResult || type === NotificationType.NewRace
            ? Flag
            : type === NotificationType.AdminAnnouncement
              ? Megaphone
              : Bell;
  return <Icon size={size} />;
}
