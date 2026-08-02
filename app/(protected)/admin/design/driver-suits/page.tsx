import { Shirt } from "lucide-react";
import TeamSuitAdmin from "@/components/characters/TeamSuitAdmin";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import { Permission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { getSuitAdminData } from "@/lib/characters/queries";

export default async function TeamSuitDesignPage() {
  await requirePermission(Permission.ManageBranding);
  const organizations = await getSuitAdminData();
  return <AppLayout><div className="page-stack page-accent-admin min-w-0"><PageHeader eyebrow="Administration" title="Fahrer-Rennanzüge" subtitle="Teamgebundene Rennanzüge verwalten. Fahrer sehen ausschließlich aktive Varianten ihrer aktuellen Organisation." icon={Shirt} /><TeamSuitAdmin organizations={organizations} /></div></AppLayout>;
}
