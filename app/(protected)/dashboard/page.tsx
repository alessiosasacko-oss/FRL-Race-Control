import PersonalDashboard from "@/components/dashboard/PersonalDashboard";
import AppLayout from "@/components/layout/AppLayout";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getPersonalDashboardLayout } from "@/lib/dashboard/layout-queries";
import { getDashboardData } from "@/lib/dashboard/queries";

export default async function DashboardPage() {
  const user = await requireAuthenticatedUser();
  const dataPromise = getDashboardData(user.id);
  const layoutPromise = getPersonalDashboardLayout(
    user.id,
    user.roles,
    dataPromise.then((data) => Boolean(data.identity.driver)),
  );
  const [data, { layout, availableWidgetIds }] = await Promise.all([
    dataPromise,
    layoutPromise,
  ]);

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
