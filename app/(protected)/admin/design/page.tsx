import { Palette } from "lucide-react";
import DesignBrandingEditor from "@/components/design/DesignBrandingEditor";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import { Permission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { getDesignAdminData } from "@/lib/design/queries";

export default async function DesignBrandingPage() {
  await requirePermission(Permission.ManageBranding);
  const data = await getDesignAdminData();

  return (
    <AppLayout>
      <div className="page-stack page-accent-admin">
        <PageHeader
          eyebrow="Administration"
          title="Design & Branding"
          subtitle="Zentrale Markensteuerung mit sicheren Tokens, Live-Vorschau und versionierter Veröffentlichung."
          icon={Palette}
        />
        <DesignBrandingEditor data={data} />
      </div>
    </AppLayout>
  );
}
