"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DriverLineupStatus, Role, roleLabels } from "@/domain";
import { Permission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/db/prisma";
import { writeSystemAudit } from "@/lib/audit/system";
import { ensureInternalTeamSlot } from "@/lib/master-data/internal-team-slots";
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
  driverAnonymizeSchema,
  driverProfileDeleteSchema,
  driverStatusSchema,
  userAndDriverDeleteSchema,
  userRoleUpdateSchema,
  userSportAssignmentSchema,
  userStatusUpdateSchema,
} from "./schemas";
import type { UserAdminActionState } from "./action-state";
import {
  getDriverDeletionSnapshot,
  getDriverDeletionSnapshotByDriverId,
} from "./driver-dependencies";
import {
  anonymizedDriverName,
  destructiveNameMatches,
} from "./driver-lifecycle";

function roleValues(formData: FormData): string[] {
  return formData.getAll("roles").map(String);
}

function refreshUserAdministration(userId?: number, driverId?: number): void {
  revalidatePath("/admin/users");
  if (userId) revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/drivers");
  if (driverId) revalidatePath(`/admin/drivers/${driverId}`);
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
    prisma.season.findFirst({
      where: {
        id: parsed.data.seasonId,
        participatingLeagues: { some: { id: parsed.data.leagueId } },
      },
      select: { id: true, name: true },
    }),
    prisma.league.findFirst({ where: { id: parsed.data.leagueId, code: { in: ["F1", "F2", "F3", "F4", "F5", "F6"] } }, select: { id: true, code: true } }),
    parsed.data.organizationId
      ? prisma.teamOrganization.findFirst({
          where: {
            id: parsed.data.organizationId,
            active: true,
            archivedAt: null,
          },
          select: { id: true, name: true },
        })
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

      const internalTeamSlot = organization
        ? await ensureInternalTeamSlot(transaction, {
            organizationId: organization.id,
            seasonId: season.id,
            leagueId: league.id,
          })
        : null;

      const driver = target.driver
      ? await transaction.driver.update({
          where: { id: target.driver.id },
          data: {
            name: parsed.data.driverName,
            number: parsed.data.number,
            countryCode: parsed.data.countryCode,
            flag: parsed.data.countryCode,
            leagueId: league.id,
            teamId: internalTeamSlot?.id ?? null,
            active: parsed.data.active,
          },
        })
      : await transaction.driver.create({
          data: {
            userId: target.id,
            name: parsed.data.driverName,
            number: parsed.data.number,
            countryCode: parsed.data.countryCode,
            flag: parsed.data.countryCode,
            leagueId: league.id,
            teamId: internalTeamSlot?.id ?? null,
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

async function performDriverStatusChange({
  actorId,
  driverId,
  active,
  reason,
}: {
  actorId: number;
  driverId: number;
  active: boolean;
  reason: string;
}): Promise<{ userId: number | null }> {
  const prisma = getPrismaClient();
  return prisma.$transaction(async (transaction) => {
    const driver = await transaction.driver.findUnique({
      where: { id: driverId },
      select: { id: true, active: true, userId: true },
    });
    if (!driver) throw new Error("DRIVER_NOT_FOUND");
    if (driver.active === active) return { userId: driver.userId };

    await transaction.driver.update({ where: { id: driver.id }, data: { active } });
    if (!active) {
      await transaction.driverSeasonAssignment.updateMany({
        where: { driverId: driver.id, active: true },
        data: { active: false },
      });
    }
    await writeSystemAudit(transaction, {
      actorId,
      action: active ? "DRIVER_REACTIVATED" : "DRIVER_DEACTIVATED",
      entityType: "Driver",
      entityId: driver.id,
      metadata: {
        userId: driver.userId,
        previous: driver.active,
        next: active,
        assignmentsReactivated: false,
        reason,
      },
    });
    return { userId: driver.userId };
  }, { isolationLevel: "Serializable" });
}

async function updateDriverStatus(
  driverId: number,
  formData: FormData,
): Promise<UserAdminActionState> {
  const actor = await requirePermission(Permission.ManageUsers);
  const parsed = driverStatusSchema.safeParse({
    active: formData.get("active"),
    confirmed: formData.get("confirmed"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Bitte Statusänderung, Grund und Bestätigung vollständig angeben." };
  }
  try {
    const result = await performDriverStatusChange({
      actorId: actor.id,
      driverId,
      active: parsed.data.active,
      reason: parsed.data.reason,
    });
    refreshUserAdministration(result.userId ?? undefined, driverId);
  } catch (error: unknown) {
    logUserAdministrationFailure("driver-status", error);
    return { status: "error", message: "Der Fahrerstatus konnte nicht geändert werden. Fehlerreferenz: DRIVER-STATUS-4A12" };
  }
  return {
    status: "success",
    message: parsed.data.active
      ? "Fahrer wurde reaktiviert. Saison- und Teamzuordnungen bleiben bis zur bewussten Neuzuweisung inaktiv."
      : "Fahrer wurde deaktiviert. Historische Ergebnisse und Zuordnungen bleiben erhalten.",
  };
}

export async function updateDriverStatusByIdAction(
  driverId: number,
  _previous: UserAdminActionState,
  formData: FormData,
): Promise<UserAdminActionState> {
  return updateDriverStatus(driverId, formData);
}

export async function updateDriverStatusAction(
  userId: number,
  _previous: UserAdminActionState,
  formData: FormData,
): Promise<UserAdminActionState> {
  const prisma = getPrismaClient();
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { driver: { select: { id: true } } },
  });
  if (!target?.driver) return { status: "error", message: "Fahrer wurde nicht gefunden." };
  return updateDriverStatus(target.driver.id, formData);
}

async function performDriverProfileDeletion({
  actorId,
  driverId,
  confirmationName,
  removeDriverRole,
  reason,
}: {
  actorId: number;
  driverId: number;
  confirmationName: string;
  removeDriverRole: boolean;
  reason: string;
}): Promise<{ userId: number | null }> {
  const prisma = getPrismaClient();
  return prisma.$transaction(async (transaction) => {
    const snapshot = await getDriverDeletionSnapshotByDriverId(transaction, driverId);
    if (!snapshot) throw new Error("DRIVER_NOT_FOUND");
    if (!destructiveNameMatches(snapshot.driver.name, confirmationName)) {
      throw new Error("DRIVER_NAME_MISMATCH");
    }
    if (!snapshot.canDeleteDriverProfile) {
      throw new Error(`DRIVER_HAS_HISTORY:${snapshot.driverBlockingMessages.join("|")}`);
    }

    await transaction.driverSeasonAssignment.deleteMany({ where: { driverId } });
    await transaction.driver.delete({ where: { id: driverId } });
    if (removeDriverRole && snapshot.user) {
      await transaction.user.update({
        where: { id: snapshot.user.id },
        data: {
          roles: snapshot.user.roles.filter((role) => role !== Role.Driver) as Role[],
        },
      });
    }
    await writeSystemAudit(transaction, {
      actorId,
      action: "DRIVER_PROFILE_DELETED",
      entityType: "DeletedDriver",
      entityId: driverId,
      metadata: {
        formerDriverId: driverId,
        linkedUserId: snapshot.user?.id ?? null,
        removedDriverRole: removeDriverRole && Boolean(snapshot.user),
        deletedSeasonAssignmentCount: snapshot.removable.seasonAssignments,
        retainedHistoricalLinkCount: 0,
        reason,
      },
    });
    return { userId: snapshot.user?.id ?? null };
  }, { isolationLevel: "Serializable" });
}

function driverProfileDeletionError(error: unknown): UserAdminActionState {
  if (error instanceof Error && error.message === "DRIVER_NAME_MISMATCH") {
    return { status: "error", message: "Der eingegebene Fahrername stimmt nicht mit der serverseitigen Bestätigung überein." };
  }
  if (error instanceof Error && error.message.startsWith("DRIVER_HAS_HISTORY:")) {
    return { status: "error", message: `Dieser Fahrer besitzt historische Daten und kann nicht gelöscht werden: ${error.message.slice("DRIVER_HAS_HISTORY:".length).split("|").join(", ")}. Deaktiviere oder anonymisiere ihn stattdessen.` };
  }
  logUserAdministrationFailure("driver-profile-delete", error);
  return { status: "error", message: "Das Fahrerprofil konnte nicht vollständig gelöscht werden. Fehlerreferenz: DRIVER-DELETE-9C21" };
}

export async function deleteDriverByIdAction(
  driverId: number,
  _previous: UserAdminActionState,
  formData: FormData,
): Promise<UserAdminActionState> {
  const actor = await requirePermission(Permission.ManageUsers);
  const parsed = driverProfileDeleteSchema.safeParse({
    confirmationName: formData.get("confirmationName"),
    irreversible: formData.get("irreversible"),
    removeDriverRole: formData.get("removeDriverRole"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Name, Unwiderruflichkeit und Grund müssen serverseitig bestätigt werden." };
  }
  let linkedUserId: number | null = null;
  try {
    const result = await performDriverProfileDeletion({
      actorId: actor.id,
      driverId,
      ...parsed.data,
    });
    linkedUserId = result.userId;
  } catch (error: unknown) {
    return driverProfileDeletionError(error);
  }
  refreshUserAdministration(linkedUserId ?? undefined, driverId);
  redirect("/admin/drivers?notice=deleted");
}

export async function deleteDriverProfileAction(
  userId: number,
  _previous: UserAdminActionState,
  formData: FormData,
): Promise<UserAdminActionState> {
  const actor = await requirePermission(Permission.ManageUsers);
  const parsed = driverProfileDeleteSchema.safeParse({
    confirmationName: formData.get("confirmationName"),
    irreversible: formData.get("irreversible"),
    removeDriverRole: formData.get("removeDriverRole"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Name, Unwiderruflichkeit und Grund müssen serverseitig bestätigt werden." };
  }
  const prisma = getPrismaClient();
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { driver: { select: { id: true } } },
  });
  if (!target?.driver) return { status: "error", message: "Fahrer wurde nicht gefunden." };
  try {
    await performDriverProfileDeletion({
      actorId: actor.id,
      driverId: target.driver.id,
      ...parsed.data,
    });
  } catch (error: unknown) {
    return driverProfileDeletionError(error);
  }
  refreshUserAdministration(userId, target.driver.id);
  return { status: "success", message: "Fahrerprofil wurde endgültig gelöscht. Das Benutzerkonto bleibt bestehen." };
}

export async function deleteUserAndDriverAction(
  userId: number,
  _previous: UserAdminActionState,
  formData: FormData,
): Promise<UserAdminActionState> {
  const actor = await requirePermission(Permission.ManageUsers);
  if (!actor.roles.includes(Role.SuperAdmin)) {
    return { status: "error", message: "Nur Super-Administratoren dürfen Benutzerkonten endgültig löschen." };
  }
  if (actor.id === userId) {
    return { status: "error", message: "Du kannst dein aktuell angemeldetes Benutzerkonto nicht selbst löschen." };
  }
  const parsed = userAndDriverDeleteSchema.safeParse({
    confirmationName: formData.get("confirmationName"),
    irreversible: formData.get("irreversible"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Name, Unwiderruflichkeit und Grund müssen serverseitig bestätigt werden." };
  }
  const prisma = getPrismaClient();
  try {
    await prisma.$transaction(async (transaction) => {
      const snapshot = await getDriverDeletionSnapshot(transaction, userId);
      if (!snapshot) throw new Error("USER_NOT_FOUND");
      const confirmationTarget = snapshot.driver?.name ?? snapshot.user.displayName;
      if (!destructiveNameMatches(confirmationTarget, parsed.data.confirmationName)) {
        throw new Error("USER_NAME_MISMATCH");
      }
      if (snapshot.user.roles.includes(Role.SuperAdmin)) {
        const superAdminCount = await transaction.user.count({
          where: { active: true, roles: { has: Role.SuperAdmin } },
        });
        if (superAdminCount <= 1) throw new Error("LAST_SUPER_ADMIN");
      }
      if (!snapshot.canDeleteUserAndDriver) {
        throw new Error(`USER_HAS_HISTORY:${[
          ...snapshot.driverBlockingMessages,
          ...snapshot.userBlockingMessages,
        ].join("|")}`);
      }

      await writeSystemAudit(transaction, {
        actorId: actor.id,
        action: "USER_AND_DRIVER_DELETED",
        entityType: "DeletedUser",
        entityId: userId,
        metadata: {
          formerUserId: userId,
          formerDriverId: snapshot.driver?.id ?? null,
          deletedAccountCount: snapshot.removable.accounts,
          deletedSessionCount: snapshot.removable.sessions,
          deletedSeasonAssignmentCount: snapshot.removable.seasonAssignments,
          retainedSystemAuditCount: snapshot.removable.retainedSystemAudits,
          retainedHistoricalLinkCount: 0,
          reason: parsed.data.reason,
        },
      });
      if (snapshot.driver) {
        await transaction.driverSeasonAssignment.deleteMany({
          where: { driverId: snapshot.driver.id },
        });
        await transaction.driver.delete({ where: { id: snapshot.driver.id } });
      }
      const abandonedUploads = await transaction.evidenceUpload.findMany({
        where: {
          userId,
          evidenceId: null,
          status: { not: "COMPLETED" },
        },
        select: { storagePath: true },
      });
      if (abandonedUploads.length > 0) {
        await transaction.evidenceStorageCleanup.createMany({
          data: abandonedUploads.map((upload) => ({ storagePath: upload.storagePath })),
          skipDuplicates: true,
        });
      }
      await transaction.user.delete({ where: { id: userId } });
    }, { isolationLevel: "Serializable" });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "USER_NAME_MISMATCH") {
      return { status: "error", message: "Der eingegebene Name stimmt nicht mit der serverseitigen Bestätigung überein." };
    }
    if (error instanceof Error && error.message === "LAST_SUPER_ADMIN") {
      return { status: "error", message: "Der letzte aktive Super-Administrator kann nicht gelöscht werden." };
    }
    if (error instanceof Error && error.message.startsWith("USER_HAS_HISTORY:")) {
      return { status: "error", message: `Dieses Konto besitzt historische Abhängigkeiten und kann nicht gelöscht werden: ${error.message.slice("USER_HAS_HISTORY:".length).split("|").filter(Boolean).join(", ")}.` };
    }
    logUserAdministrationFailure("user-driver-delete", error);
    return { status: "error", message: "Benutzerkonto und Fahrer konnten nicht gelöscht werden. Fehlerreferenz: USER-DELETE-2F84" };
  }
  refreshUserAdministration(userId);
  return { status: "success", message: "Benutzerkonto, Auth.js-Verknüpfungen, Sessions und Fahrerprofil wurden endgültig gelöscht." };
}

async function performDriverAnonymization({
  actorId,
  driverId,
  confirmationName,
  reason,
}: {
  actorId: number;
  driverId: number;
  confirmationName: string;
  reason: string;
}): Promise<{ userId: number | null }> {
  const prisma = getPrismaClient();
  return prisma.$transaction(async (transaction) => {
    const snapshot = await getDriverDeletionSnapshotByDriverId(transaction, driverId);
    if (!snapshot) throw new Error("DRIVER_NOT_FOUND");
    if (!destructiveNameMatches(snapshot.driver.name, confirmationName)) {
      throw new Error("DRIVER_NAME_MISMATCH");
    }
    const anonymousName = anonymizedDriverName(driverId);
    await transaction.driver.update({
      where: { id: driverId },
      data: { name: anonymousName, flag: "XX", countryCode: "XX", active: false },
    });
    await transaction.driverSeasonAssignment.updateMany({
      where: { driverId, active: true },
      data: { active: false },
    });
    if (snapshot.user) {
      const userId = snapshot.user.id;
      await transaction.account.deleteMany({ where: { userId } });
      await transaction.session.deleteMany({ where: { userId } });
      await transaction.emailDelivery.deleteMany({ where: { userId } });
      await transaction.notification.deleteMany({ where: { userId } });
      await transaction.user.update({
        where: { id: userId },
        data: {
          displayName: anonymousName,
          discordId: null,
          discordUsername: null,
          discordGlobalName: null,
          discordGuildNickname: null,
          discordAvatarUrl: null,
          discordVerifiedAt: null,
          discordSyncedAt: null,
          email: null,
          emailVerified: null,
          avatarUrl: null,
        },
      });
    }
    await writeSystemAudit(transaction, {
      actorId,
      action: "DRIVER_ANONYMIZED",
      entityType: "Driver",
      entityId: driverId,
      metadata: {
        userId: snapshot.user?.id ?? null,
        removedAccountCount: snapshot.removable.accounts,
        removedSessionCount: snapshot.removable.sessions,
        retainedHistoricalLinkCount: snapshot.driverBlockingMessages.length,
        reason,
      },
    });
    return { userId: snapshot.user?.id ?? null };
  }, { isolationLevel: "Serializable" });
}

function driverAnonymizationError(error: unknown): UserAdminActionState {
  if (error instanceof Error && error.message === "DRIVER_NAME_MISMATCH") {
    return { status: "error", message: "Der eingegebene Fahrername stimmt nicht mit der serverseitigen Bestätigung überein." };
  }
  logUserAdministrationFailure("driver-anonymize", error);
  return { status: "error", message: "Die Fahrerdaten konnten nicht anonymisiert werden. Fehlerreferenz: DRIVER-ANON-6D33" };
}

export async function anonymizeDriverByIdAction(
  driverId: number,
  _previous: UserAdminActionState,
  formData: FormData,
): Promise<UserAdminActionState> {
  const actor = await requirePermission(Permission.ManageUsers);
  if (!actor.roles.includes(Role.SuperAdmin)) {
    return { status: "error", message: "Nur Super-Administratoren dürfen Fahrerdaten anonymisieren." };
  }
  const parsed = driverAnonymizeSchema.safeParse({
    confirmationName: formData.get("confirmationName"),
    irreversible: formData.get("irreversible"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Name, Unwiderruflichkeit und Grund müssen serverseitig bestätigt werden." };
  }
  const snapshot = await getDriverDeletionSnapshotByDriverId(getPrismaClient(), driverId);
  if (!snapshot) return { status: "error", message: "Fahrer wurde nicht gefunden." };
  if (snapshot.user?.id === actor.id) {
    return { status: "error", message: "Du kannst dein aktuell angemeldetes Profil nicht selbst anonymisieren." };
  }
  try {
    const result = await performDriverAnonymization({
      actorId: actor.id,
      driverId,
      confirmationName: parsed.data.confirmationName,
      reason: parsed.data.reason,
    });
    refreshUserAdministration(result.userId ?? undefined, driverId);
  } catch (error: unknown) {
    return driverAnonymizationError(error);
  }
  return { status: "success", message: "Personenbezogene Fahrerdaten wurden anonymisiert; sportliche Historie und Punkte bleiben erhalten." };
}

export async function anonymizeDriverAction(
  userId: number,
  _previous: UserAdminActionState,
  formData: FormData,
): Promise<UserAdminActionState> {
  const actor = await requirePermission(Permission.ManageUsers);
  if (!actor.roles.includes(Role.SuperAdmin)) {
    return { status: "error", message: "Nur Super-Administratoren dürfen Fahrerdaten anonymisieren." };
  }
  if (actor.id === userId) {
    return { status: "error", message: "Du kannst dein aktuell angemeldetes Profil nicht selbst anonymisieren." };
  }
  const parsed = driverAnonymizeSchema.safeParse({
    confirmationName: formData.get("confirmationName"),
    irreversible: formData.get("irreversible"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Name, Unwiderruflichkeit und Grund müssen serverseitig bestätigt werden." };
  }
  const prisma = getPrismaClient();
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { driver: { select: { id: true } } },
  });
  if (!target?.driver) return { status: "error", message: "Fahrer wurde nicht gefunden." };
  try {
    await performDriverAnonymization({
      actorId: actor.id,
      driverId: target.driver.id,
      confirmationName: parsed.data.confirmationName,
      reason: parsed.data.reason,
    });
  } catch (error: unknown) {
    return driverAnonymizationError(error);
  }
  refreshUserAdministration(userId, target.driver.id);
  return { status: "success", message: "Personenbezogene Fahrerdaten wurden anonymisiert; sportliche Historie und Punkte bleiben erhalten." };
}
