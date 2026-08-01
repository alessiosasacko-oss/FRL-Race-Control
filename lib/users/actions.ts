"use server";

import { revalidatePath } from "next/cache";
import { DriverLineupStatus, Role, roleLabels } from "@/domain";
import { Permission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { countryCodeToFlagEmoji } from "@/lib/countries";
import { getPrismaClient } from "@/lib/db/prisma";
import { writeSystemAudit } from "@/lib/audit/system";
import {
  activeUserRoleRequirementMessage,
  primarySlotAvailable,
  validateRoleChange,
} from "./policy";
import {
  logUserAdministrationFailure,
  logUserRoleAdministrationEvent,
} from "./diagnostics";
import {
  userRoleUpdateSchema,
  userSportAssignmentSchema,
  userStatusUpdateSchema,
} from "./schemas";
import type { UserAdminActionState } from "./action-state";

function roleValues(formData: FormData): string[] {
  return formData.getAll("roles").map(String);
}

function refreshUserAdministration(userId: number): void {
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/drivers");
  revalidatePath("/drivers");
  revalidatePath("/teams");
  revalidatePath("/dashboard");
}

export async function updateUserRolesAction(
  userId: number,
  _previous: UserAdminActionState,
  formData: FormData,
): Promise<UserAdminActionState> {
  const actor = await requirePermission(Permission.ManageUsers);
  const submittedRoles = roleValues(formData);
  logUserRoleAdministrationEvent({
    phase: "action-start",
    actorId: actor.id,
    targetId: userId,
  });
  if (submittedRoles.length === 0) {
    return {
      status: "error",
      message: activeUserRoleRequirementMessage,
    };
  }
  if (formData.get("confirmed") !== "on") {
    return {
      status: "error",
      message: "Bitte bestätige die angezeigte Rollenänderung.",
    };
  }
  const parsed = userRoleUpdateSchema.safeParse({
    roles: submittedRoles,
    confirmed: formData.get("confirmed"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Die ausgewählten Rollen sind ungültig." };
  }

  const prisma = getPrismaClient();
  const [target, activeSuperAdminCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: {
        driver: {
          select: {
            id: true,
            seasonAssignments: { where: { active: true }, select: { organizationId: true } },
          },
        },
        principalTeams: { take: 1, select: { id: true } },
        organizationSeasons: { take: 1, select: { id: true } },
      },
    }),
    prisma.user.count({ where: { active: true, roles: { has: Role.SuperAdmin } } }),
  ]);
  if (!target) return { status: "error", message: "Benutzer wurde nicht gefunden." };

  const nextRoles = [...new Set(parsed.data.roles)];
  const currentRoles = target.roles as Role[];
  const policyError = validateRoleChange({
    actorRoles: actor.roles,
    actorId: actor.id,
    targetId: target.id,
    currentRoles,
    nextRoles,
    activeSuperAdminCount,
  });
  logUserRoleAdministrationEvent({
    phase: "policy-result",
    actorId: actor.id,
    targetId: target.id,
    previousRoles: currentRoles,
    nextRoles,
    result: policyError ? "rejected" : "allowed",
  });
  if (policyError) return { status: "error", message: policyError };

  const added = nextRoles.filter((role) => !currentRoles.includes(role));
  const removed = currentRoles.filter((role) => !nextRoles.includes(role));
  if (!added.length && !removed.length) {
    return { status: "success", message: "Die Rollen sind unverändert.", changes: [] };
  }

  try {
    logUserRoleAdministrationEvent({
      phase: "transaction-start",
      actorId: actor.id,
      targetId: target.id,
      previousRoles: currentRoles,
      nextRoles,
      result: "started",
    });
    await prisma.$transaction(async (transaction) => {
      await transaction.user.update({ where: { id: target.id }, data: { roles: nextRoles } });
      for (const role of added) {
        await writeSystemAudit(transaction, {
          actorId: actor.id,
          action: "USER_ROLE_ADDED",
          entityType: "User",
          entityId: target.id,
          metadata: { role, previous: currentRoles, next: nextRoles, reason: parsed.data.reason },
        });
      }
      for (const role of removed) {
        await writeSystemAudit(transaction, {
          actorId: actor.id,
          action: "USER_ROLE_REMOVED",
          entityType: "User",
          entityId: target.id,
          metadata: { role, previous: currentRoles, next: nextRoles, reason: parsed.data.reason },
        });
      }
      const reloaded = await transaction.user.findUnique({
        where: { id: target.id },
        select: { id: true, roles: true, active: true },
      });
      if (!reloaded) throw new Error("UPDATED_USER_NOT_FOUND");
    });
    logUserRoleAdministrationEvent({
      phase: "transaction-result",
      actorId: actor.id,
      targetId: target.id,
      previousRoles: currentRoles,
      nextRoles,
      result: "committed",
    });
  } catch (error: unknown) {
    logUserAdministrationFailure("role-update-transaction", error);
    return {
      status: "error",
      message: "Die Rollen konnten nicht gespeichert werden. Es wurden keine Teiländerungen übernommen. Fehlerreferenz: ROLE-7F31",
    };
  }

  let revalidationFailed = false;
  try {
    refreshUserAdministration(target.id);
    logUserRoleAdministrationEvent({
      phase: "revalidation-result",
      actorId: actor.id,
      targetId: target.id,
      previousRoles: currentRoles,
      nextRoles,
      result: "completed",
    });
  } catch (error: unknown) {
    revalidationFailed = true;
    logUserAdministrationFailure("role-update-revalidation", error);
    logUserRoleAdministrationEvent({
      phase: "revalidation-result",
      actorId: actor.id,
      targetId: target.id,
      previousRoles: currentRoles,
      nextRoles,
      result: "failed",
    });
  }
  const advisories = [
    added.includes(Role.Driver) && !target.driver
      ? "Fahrerrolle gespeichert. Für Rennanmeldung und Liga-Zuordnung muss noch ein Fahrerprofil eingerichtet werden."
      : null,
    added.includes(Role.TeamPrincipal) &&
    target.principalTeams.length === 0 &&
    target.organizationSeasons.length === 0
      ? "Teamchefrolle gespeichert. Teambezogene Rechte werden erst nach einer Teamzuordnung aktiv."
      : null,
    revalidationFailed
      ? "Die Rollen wurden gespeichert, die Verwaltungsansicht konnte aber nicht automatisch aktualisiert werden. Bitte lade die Seite neu. Fehlerreferenz: ROLE-2C18"
      : null,
  ].filter((message): message is string => Boolean(message));
  return {
    status: "success",
    message: advisories.length
      ? advisories.join(" ")
      : "Rollen wurden gespeichert. Die neuen Rechte gelten ab dem nächsten Request.",
    changes: [
      ...added.map((role) => `${roleLabels[role]}: hinzugefügt`),
      ...removed.map((role) => `${roleLabels[role]}: entfernt`),
    ],
  };
}

export async function updateUserSportAssignmentAction(
  userId: number,
  _previous: UserAdminActionState,
  formData: FormData,
): Promise<UserAdminActionState> {
  const actor = await requirePermission(Permission.ManageUsers);
  const parsed = userSportAssignmentSchema.safeParse({
    seasonId: formData.get("seasonId"),
    leagueId: formData.get("leagueId"),
    organizationId: formData.get("organizationId"),
    lineupStatus: formData.get("lineupStatus"),
    replacementDriverId: formData.get("replacementDriverId"),
    driverName: formData.get("driverName"),
    number: formData.get("number"),
    countryCode: formData.get("countryCode"),
    active: formData.get("active"),
    confirmed: formData.get("confirmed"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Bitte sportliche Zuordnung vollständig angeben und bestätigen." };
  }

  const prisma = getPrismaClient();
  const [target, season, league, organization, replacement] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: {
        driver: {
          include: {
            team: { select: { organizationId: true } },
            seasonAssignments: true,
          },
        },
      },
    }),
    prisma.season.findUnique({ where: { id: parsed.data.seasonId }, select: { id: true, name: true } }),
    prisma.league.findFirst({ where: { id: parsed.data.leagueId, code: { in: ["F1", "F2", "F3", "F4", "F5", "F6"] } }, select: { id: true, code: true } }),
    parsed.data.organizationId
      ? prisma.teamOrganization.findUnique({ where: { id: parsed.data.organizationId }, select: { id: true, name: true } })
      : Promise.resolve(null),
    parsed.data.replacementDriverId
      ? prisma.driverSeasonAssignment.findUnique({
          where: { driverId_seasonId: { driverId: parsed.data.replacementDriverId, seasonId: parsed.data.seasonId } },
          select: { driverId: true, seasonId: true, leagueId: true, organizationId: true, lineupStatus: true, active: true },
        })
      : Promise.resolve(null),
  ]);
  if (!target || !season || !league) {
    return { status: "error", message: "Benutzer, Saison oder Liga wurde nicht gefunden." };
  }
  if (parsed.data.replacementDriverId && (
    parsed.data.lineupStatus !== DriverLineupStatus.Primary ||
    !replacement ||
    replacement.driverId === target.driver?.id ||
    replacement.seasonId !== season.id ||
    replacement.leagueId !== league.id ||
    replacement.organizationId !== organization?.id ||
    replacement.lineupStatus !== DriverLineupStatus.Primary ||
    !replacement.active
  )) {
    return { status: "error", message: "Der ausgewählte Stammfahrer gehört nicht zu diesem Saison-, Liga- und Team-Slot." };
  }

  const matchingTeam = organization
    ? await prisma.team.findFirst({
        where: {
          organizationId: organization.id,
          seasonId: season.id,
          leagueId: league.id,
          active: true,
          archivedAt: null,
        },
        select: { id: true },
      })
    : null;
  if (parsed.data.lineupStatus === DriverLineupStatus.Primary && organization) {
    const existingPrimaryDrivers = await prisma.driverSeasonAssignment.count({
      where: {
        seasonId: season.id,
        leagueId: league.id,
        organizationId: organization.id,
        lineupStatus: DriverLineupStatus.Primary,
        active: true,
        driverId: target.driver ? { not: target.driver.id } : undefined,
      },
    });
    if (!primarySlotAvailable(existingPrimaryDrivers) && !replacement) {
      return {
        status: "error",
        message: `${organization.name} besitzt in ${league.code} bereits zwei aktive Stammfahrer. Weise den Fahrer als Ersatzfahrer zu oder ersetze einen Stammfahrer bewusst.`,
      };
    }
  }

  const previousAssignment = target.driver?.seasonAssignments.find(
    (assignment) => assignment.seasonId === season.id,
  );
  const previousSport = {
    leagueId: previousAssignment?.leagueId ?? target.driver?.leagueId ?? null,
    organizationId: previousAssignment?.organizationId ?? target.driver?.team?.organizationId ?? null,
    lineupStatus: previousAssignment?.lineupStatus ?? null,
    number: target.driver?.number ?? null,
    countryCode: target.driver?.countryCode ?? null,
    active: target.driver?.active ?? false,
  };
  const nextSport = {
    leagueId: league.id,
    organizationId: organization?.id ?? null,
    lineupStatus: parsed.data.lineupStatus,
    number: parsed.data.number,
    countryCode: parsed.data.countryCode,
    active: parsed.data.active,
  };
  const auditChanges = [
    ["USER_LEAGUE_CHANGED", previousSport.leagueId, nextSport.leagueId],
    ["USER_TEAM_CHANGED", previousSport.organizationId, nextSport.organizationId],
    ["USER_LINEUP_STATUS_CHANGED", previousSport.lineupStatus, nextSport.lineupStatus],
    ["USER_DRIVER_NUMBER_CHANGED", previousSport.number, nextSport.number],
    ["USER_COUNTRY_CHANGED", previousSport.countryCode, nextSport.countryCode],
    ["USER_DRIVER_STATUS_CHANGED", previousSport.active, nextSport.active],
  ].filter(([, previous, next]) => previous !== next);
  try {
    await prisma.$transaction(async (transaction) => {
      if (parsed.data.lineupStatus === DriverLineupStatus.Primary && organization) {
        const primaryCount = await transaction.driverSeasonAssignment.count({
          where: {
            seasonId: season.id,
            leagueId: league.id,
            organizationId: organization.id,
            lineupStatus: DriverLineupStatus.Primary,
            active: true,
            driverId: {
              notIn: [target.driver?.id, replacement?.driverId].filter((id): id is number => Boolean(id)),
            },
          },
        });
        if (!primarySlotAvailable(primaryCount)) throw new Error("PRIMARY_SLOT_FULL");
      }

      if (replacement) {
        await transaction.driverSeasonAssignment.update({
          where: { driverId_seasonId: { driverId: replacement.driverId, seasonId: replacement.seasonId } },
          data: { lineupStatus: DriverLineupStatus.Substitute },
        });
        await writeSystemAudit(transaction, {
          actorId: actor.id,
          action: "USER_LINEUP_STATUS_CHANGED",
          entityType: "Driver",
          entityId: replacement.driverId,
          metadata: { seasonId: season.id, previous: DriverLineupStatus.Primary, next: DriverLineupStatus.Substitute, replacementForUserId: target.id, reason: parsed.data.reason },
        });
      }

      const driver = target.driver
      ? await transaction.driver.update({
          where: { id: target.driver.id },
          data: {
            name: parsed.data.driverName,
            number: parsed.data.number,
            countryCode: parsed.data.countryCode,
            flag: countryCodeToFlagEmoji(parsed.data.countryCode) ?? "🌐",
            leagueId: league.id,
            teamId: matchingTeam?.id ?? null,
            active: parsed.data.active,
          },
        })
      : await transaction.driver.create({
          data: {
            userId: target.id,
            name: parsed.data.driverName,
            number: parsed.data.number,
            countryCode: parsed.data.countryCode,
            flag: countryCodeToFlagEmoji(parsed.data.countryCode) ?? "🌐",
            leagueId: league.id,
            teamId: matchingTeam?.id ?? null,
            active: parsed.data.active,
          },
        });
      await transaction.driverSeasonAssignment.upsert({
      where: { driverId_seasonId: { driverId: driver.id, seasonId: season.id } },
      create: {
        driverId: driver.id,
        seasonId: season.id,
        leagueId: league.id,
        organizationId: organization?.id ?? null,
        lineupStatus: parsed.data.lineupStatus,
        active: parsed.data.active,
      },
      update: {
        leagueId: league.id,
        organizationId: organization?.id ?? null,
        lineupStatus: parsed.data.lineupStatus,
        active: parsed.data.active,
      },
    });
      for (const [action, previous, next] of auditChanges) {
        await writeSystemAudit(transaction, {
        actorId: actor.id,
        action: String(action),
        entityType: "Driver",
        entityId: driver.id,
        metadata: {
          userId: target.id,
          seasonId: season.id,
          previous: previous ?? null,
          next: next ?? null,
          reason: parsed.data.reason,
        },
        });
      }
    }, { isolationLevel: "Serializable" });
  } catch (error: unknown) {
    const code = typeof error === "object" && error && "code" in error
      ? String(error.code)
      : null;
    if (error instanceof Error && error.message === "PRIMARY_SLOT_FULL") {
      return { status: "error", message: `${organization?.name ?? "Das Team"} besitzt in ${league.code} bereits zwei aktive Stammfahrer.` };
    }
    if (code === "P2034") {
      return { status: "error", message: "Die Zuordnung wurde gleichzeitig geändert. Bitte prüfe die Stammplätze und versuche es erneut." };
    }
    return { status: "error", message: "Die sportliche Zuordnung konnte nicht gespeichert werden." };
  }

  refreshUserAdministration(target.id);
  return {
    status: "success",
    message: `${target.displayName} wurde ${league.code}${organization ? ` · ${organization.name}` : " · ohne Team"} zugeordnet.`,
  };
}

export async function updateUserStatusAction(
  userId: number,
  _previous: UserAdminActionState,
  formData: FormData,
): Promise<UserAdminActionState> {
  const actor = await requirePermission(Permission.ManageUsers);
  const parsed = userStatusUpdateSchema.safeParse({
    active: formData.get("active"),
    confirmed: formData.get("confirmed"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { status: "error", message: "Statusänderung muss bestätigt werden." };
  if (actor.id === userId && !parsed.data.active) {
    return { status: "error", message: "Du kannst dein eigenes Konto nicht sperren." };
  }
  const prisma = getPrismaClient();
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { active: true } });
  if (!target) return { status: "error", message: "Benutzer wurde nicht gefunden." };
  await prisma.$transaction(async (transaction) => {
    await transaction.user.update({ where: { id: userId }, data: { active: parsed.data.active } });
    if (!parsed.data.active) await transaction.session.deleteMany({ where: { userId } });
    await writeSystemAudit(transaction, {
      actorId: actor.id,
      action: parsed.data.active ? "USER_ACTIVATED" : "USER_BLOCKED",
      entityType: "User",
      entityId: userId,
      metadata: { previous: target.active, next: parsed.data.active, reason: parsed.data.reason },
    });
  });
  refreshUserAdministration(userId);
  return { status: "success", message: parsed.data.active ? "Benutzer wurde aktiviert." : "Benutzer wurde gesperrt." };
}
