import { requireAuthenticatedUser } from "@/lib/auth/session";
import DeferredAppAutoRefresh from "@/components/live/DeferredAppAutoRefresh";
import AppShell from "@/components/layout/AppShell";

type ProtectedLayoutProps = {
  children: React.ReactNode;
};

export default async function ProtectedLayout({
  children,
}: ProtectedLayoutProps) {
  const user = await requireAuthenticatedUser();

  return (
    <AppShell user={user}>
      {children}
      <DeferredAppAutoRefresh />
    </AppShell>
  );
}
