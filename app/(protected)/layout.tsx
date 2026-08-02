import { requireAuthenticatedUser } from "@/lib/auth/session";
import AppAutoRefresh from "@/components/live/AppAutoRefresh";

type ProtectedLayoutProps = {
  children: React.ReactNode;
};

export default async function ProtectedLayout({
  children,
}: ProtectedLayoutProps) {
  await requireAuthenticatedUser();

  return (
    <>
      {children}
      <AppAutoRefresh />
    </>
  );
}
