import PersonalDashboard from "@/components/dashboard/PersonalDashboard";
import AppLayout from "@/components/layout/AppLayout";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getPersonalDashboardLayout } from "@/lib/dashboard/layout-queries";
import { getDashboardData } from "@/lib/dashboard/queries";

export default async function DashboardPage() {
  const user = await requireAuthenticatedUser();
  const data = await getDashboardData(user.id);
  const { layout, availableWidgetIds } = await getPersonalDashboardLayout(
    user.id,
    user.roles,
    Boolean(data.identity.driver),
  );

  return (
    <AppLayout>
      <PersonalDashboard
        key={layout.updatedAt}
        data={data}
        initialLayout={layout}
        availableWidgetIds={availableWidgetIds}
      />
    </AppLayout>
  );
}
