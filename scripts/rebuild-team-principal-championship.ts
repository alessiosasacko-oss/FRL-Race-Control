import { config as loadEnvironment } from "dotenv";
import { getPrismaClient } from "../lib/db/prisma";
import { synchronizeGlobalTeamPrincipalChampionship } from "../lib/championship/team-principal-championship";

loadEnvironment({ path: ".env.local", quiet: true });
loadEnvironment({ path: ".env", quiet: true });

const prisma = getPrismaClient();
const races = await prisma.race.findMany({
  orderBy: [{ seasonId: "asc" }, { round: "asc" }],
  select: { id: true },
});

for (const race of races) {
  await prisma.$transaction((transaction) =>
    synchronizeGlobalTeamPrincipalChampionship(
      transaction,
      race.id,
    ),
  );
}

const [organizationCount, standingCount, weekendStatuses] =
  await prisma.$transaction([
    prisma.teamOrganization.count(),
    prisma.globalTeamStanding.count(),
    prisma.globalRaceWeekend.groupBy({
      by: ["status"],
      orderBy: { status: "asc" },
      _count: true,
    }),
  ]);
console.info(
  `Teamchef-WM synchronisiert: ${races.length} Rennwochenende(n), ${organizationCount} Organisation(en), ${standingCount} Ranglistenposition(en).`,
);
console.info(
  "Wochenendstatus:",
  weekendStatuses.map((status) => ({
    status: status.status,
    count: status._count,
  })),
);
await prisma.$disconnect();
