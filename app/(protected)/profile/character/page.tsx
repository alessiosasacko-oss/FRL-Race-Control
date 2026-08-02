import { UserRoundCog } from "lucide-react";
import DriverCharacterEditor from "@/components/characters/DriverCharacterEditor";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getCharacterEditorData } from "@/lib/characters/queries";

export default async function DriverCharacterPage() {
  const user = await requireAuthenticatedUser();
  const data = await getCharacterEditorData(user.id);
  if (!data) throw new Error("USER_NOT_FOUND");
  return <AppLayout><div className="page-stack min-w-0"><PageHeader eyebrow="Fahrerprofil" title="Dein FRL-Fahrer" subtitle="Gestalte deinen persönlichen FRL-Auftritt. Dein Rennanzug folgt automatisch deinem aktiven Team." icon={UserRoundCog} /><DriverCharacterEditor data={data} /></div></AppLayout>;
}
