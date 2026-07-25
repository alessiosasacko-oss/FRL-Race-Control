import AttendanceScreen from "@/components/championship/AttendanceScreen";

type AdminAttendancePageProps = {
  searchParams: Promise<
    Record<string, string | string[] | undefined>
  >;
};

export default function AdminAttendancePage({
  searchParams,
}: AdminAttendancePageProps) {
  return (
    <AttendanceScreen searchParams={searchParams} adminMode />
  );
}
