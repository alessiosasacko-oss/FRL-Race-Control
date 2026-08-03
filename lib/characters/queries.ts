import "server-only";
import { getPrismaClient } from "@/lib/db/prisma";
import { characterView, suitView } from "./resolve";

export async function getCharacterEditorData(userId: number) {
  const user = await getPrismaClient().user.findUnique({
    where: { id: userId },
    select: {
      displayName: true,
      driverCharacter: {
        select: {
          id: true,
          configuration: true,
          normalPose: true,
          winnerPose: true,
          version: true,
          suitVariantId: true,
        },
      },
      driver: {
        select: {
          name: true,
          number: true,
          flag: true,
          seasonAssignments: {
            where: {
              active: true,
              season: { active: true, archivedAt: null },
            },
            orderBy: { seasonId: "desc" },
            take: 1,
            select: {
              organization: {
                select: {
                  id: true,
                  name: true,
                  color: true,
                  logoUrl: true,
                  secondaryColor: true,
                  contrastColor: true,
                  suitTemplates: {
                    where: { active: true, archivedAt: null },
                    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
                    select: {
                      id: true,
                      organizationId: true,
                      name: true,
                      configuration: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!user) return null;
  const organization = user.driver?.seasonAssignments[0]?.organization ?? null;
  const templates = organization?.suitTemplates.map((template) => suitView(template, organization)) ?? [];
  const character = characterView(user.driverCharacter);
  const selectedSuit = templates.find((template) => template.id === character.suitVariantId) ?? suitView(null, organization);
  return { displayName: user.displayName, driver: user.driver ? { name: user.driver.name, number: user.driver.number, flag: user.driver.flag } : null, organization: organization ? { id: organization.id, name: organization.name, color: organization.color, logoUrl: organization.logoUrl } : null, character, selectedSuit, templates };
}

export async function getSuitAdminData() {
  return getPrismaClient().teamOrganization.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, color: true, secondaryColor: true, contrastColor: true, logoUrl: true, suitTemplates: { orderBy: [{ archivedAt: "asc" }, { displayOrder: "asc" }, { name: "asc" }], select: { id: true, organizationId: true, name: true, configuration: true, active: true, archivedAt: true, displayOrder: true } } },
  });
}
