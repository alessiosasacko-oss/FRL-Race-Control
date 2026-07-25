import AttendanceScreen from "@/components/championship/AttendanceScreen";

type AttendancePageProps = {
  searchParams: Promise<
    Record<string, string | string[] | undefined>
  >;
};

export default function AttendancePage({
  searchParams,
}: AttendancePageProps) {
  return <AttendanceScreen searchParams={searchParams} />;
}
