"use client";

import { useActionState } from "react";
import Link from "next/link";
import { CheckCircle2, ClipboardCheck, XCircle } from "lucide-react";
import {
  AttendanceStatus,
  attendanceStatusLabels,
} from "@/domain";
import { updateAttendanceAction } from "@/lib/championship/actions";
import { initialSportsActionState } from "@/lib/championship/types";
import type { DashboardData } from "@/lib/dashboard/types";
import FormMessage from "@/components/ui/FormMessage";
import DashboardCard from "./DashboardCard";

export default function AttendanceWidget({
  race,
  driverId,
  attendance,
}: {
  race: DashboardData["nextRace"];
  driverId: number | null;
  attendance: DashboardData["attendance"];
}) {
  const [state, action, pending] = useActionState(
    updateAttendanceAction,
    initialSportsActionState,
  );

  return (
    <DashboardCard icon={ClipboardCheck} title="Rennanmeldung">
      {race && driverId && attendance ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-4">
            <p className="text-xs uppercase tracking-widest text-slate-500">
              Aktueller Status
            </p>
            <p className="mt-2 text-xl font-bold text-white">
              {attendanceStatusLabels[attendance.status]}
            </p>
            <p className="mt-2 text-sm text-slate-400">
              {race.attendanceDeadline
                ? `Frist: ${new Intl.DateTimeFormat("de-DE", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(race.attendanceDeadline))}`
                : "Keine Frist gesetzt"}
            </p>
          </div>
          {attendance.canChange ? (
            <form action={action} className="grid gap-2 sm:grid-cols-2">
              <input type="hidden" name="raceId" value={race.id} />
              <input type="hidden" name="driverId" value={driverId} />
              <input type="hidden" name="substituteDriverId" value="" />
              <input type="hidden" name="representedTeamId" value="" />
              <button
                name="status"
                value={AttendanceStatus.Registered}
                disabled={pending}
                className="wizard-primary-button"
              >
                <CheckCircle2 size={18} />
                Zusagen
              </button>
              <button
                name="status"
                value={AttendanceStatus.Declined}
                disabled={pending}
                className="wizard-secondary-button"
              >
                <XCircle size={18} />
                Absagen
              </button>
            </form>
          ) : (
            <p className="text-sm text-amber-300">
              Die Rennanmeldung ist geschlossen.
            </p>
          )}
          <FormMessage state={state} />
          <Link
            href={`/attendance?raceId=${race.id}`}
            className="block text-center text-sm font-semibold text-blue-400 hover:text-blue-300"
          >
            Details und Ersatzfahrer
          </Link>
        </div>
      ) : (
        <p className="py-8 text-center text-slate-400">
          Keine persönliche Rennanmeldung verfügbar.
        </p>
      )}
    </DashboardCard>
  );
}
