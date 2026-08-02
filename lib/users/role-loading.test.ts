import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { Role } from "@/domain";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import { validateRoleChange } from "./policy";

function source(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

const actions = source("lib/users/actions.ts");
const queries = source("lib/users/queries.ts");
const listPage = source("app/(protected)/admin/users/page.tsx");
const detailPage = source("app/(protected)/admin/users/[id]/page.tsx");
const adapter = source("lib/auth/adapter.ts");
const prismaClient = source("lib/db/prisma.ts");
const diagnostics = source("lib/users/diagnostics.ts");
const actionState = source("lib/users/action-state.ts");
const userForms = source("components/users/UserAdminForms.tsx");

function typescriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return typescriptFiles(path);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

const basePolicy = {
  actorRoles: [Role.Admin],
  actorId: 1,
  targetId: 2,
  currentRoles: [Role.Driver],
  activeSuperAdminCount: 2,
};

test("admin can add DRIVER", () => {
  assert.equal(validateRoleChange({ ...basePolicy, currentRoles: [Role.Steward], nextRoles: [Role.Steward, Role.Driver] }), null);
});

test("user actions export only async runtime functions", () => {
  const runtimeExports = [...actions.matchAll(/^export\s+(?!type\s|interface\s)(.+)$/gm)]
    .map((match) => match[0]);
  assert.deepEqual(runtimeExports, [
    "export async function updateUserRolesAction(",
    "export async function updateUserSportAssignmentAction(",
    "export async function updateUserStatusAction(",
    "export async function updateDriverStatusByIdAction(",
    "export async function updateDriverStatusAction(",
    "export async function deleteDriverByIdAction(",
    "export async function deleteDriverProfileAction(",
    "export async function deleteUserAndDriverAction(",
    "export async function anonymizeDriverByIdAction(",
    "export async function anonymizeDriverAction(",
  ]);
});

test("all use-server modules export only async runtime functions", () => {
  const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
  const sourceFiles = ["app", "components", "lib"].flatMap((directory) =>
    typescriptFiles(join(repositoryRoot, directory)),
  );
  const violations = sourceFiles.flatMap((path) => {
    const content = readFileSync(path, "utf8");
    if (!/^\s*["']use server["'];?/m.test(content)) return [];
    return [...content.matchAll(/^export\s+(?!type\s|interface\s)(.+)$/gm)]
      .map((match) => match[0])
      .filter((statement) => !statement.startsWith("export async function"))
      .map((statement) => `${path}: ${statement}`);
  });
  assert.deepEqual(violations, []);
});

test("user action state lives outside the use-server module", () => {
  assert.doesNotMatch(actionState, /use server/);
  assert.match(actionState, /export const initialUserAdminActionState/);
  assert.doesNotMatch(actions, /export const initialUserAdminActionState/);
});

test("user admin forms import initial state from the neutral module", () => {
  assert.match(userForms, /from "@\/lib\/users\/action-state"/);
  assert.doesNotMatch(userForms, /initialUserAdminActionState,[\s\S]*from "@\/lib\/users\/actions"/);
});

test("admin can add STEWARD", () => {
  assert.equal(validateRoleChange({ ...basePolicy, nextRoles: [Role.Driver, Role.Steward] }), null);
});

test("admin can remove a non-protected role", () => {
  assert.equal(validateRoleChange({ ...basePolicy, currentRoles: [Role.Driver, Role.Steward], nextRoles: [Role.Driver] }), null);
});

test("role changes create explicit audit entries", () => {
  assert.match(actions, /USER_ROLE_ADDED/);
  assert.match(actions, /USER_ROLE_REMOVED/);
});

test("user without driver profile remains renderable", () => {
  assert.match(detailPage, /Kein Fahrerprofil/);
  assert.match(listPage, /Kein Fahrerprofil/);
});

test("driver without team receives a safe label", () => {
  assert.match(detailPage, /Kein Team zugeordnet/);
  assert.match(listPage, /Kein Team zugeordnet/);
});

test("missing active season assignment receives a safe label", () => {
  assert.match(detailPage, /Keine aktive Saisonzuordnung/);
  assert.match(listPage, /Keine aktive Saisonzuordnung/);
});

test("legacy FIA_PRESIDENT remains recognized", () => {
  assert.match(detailPage, /Role\.FiaPresident/);
  assert.match(source("components/users/UserAdminForms.tsx"), /Legacy-Rolle/);
});

test("team principal without a real team assignment can be stored", () => {
  assert.equal(validateRoleChange({ ...basePolicy, nextRoles: [Role.Driver, Role.TeamPrincipal] }), null);
});

test("driver without a profile can be stored", () => {
  assert.equal(validateRoleChange({ ...basePolicy, currentRoles: [Role.Steward], nextRoles: [Role.Steward, Role.Driver] }), null);
});

test("roleless active users receive the explicit policy message", () => {
  assert.match(source("lib/users/policy.ts"), /Ein aktives Benutzerkonto benötigt mindestens eine Systemrolle/);
  assert.match(source("lib/users/schemas.ts"), /activeUserRoleRequirementMessage/);
});

test("missing role confirmation receives the explicit message", () => {
  assert.match(actions, /Bitte bestätige die angezeigte Rollenänderung/);
});

test("driver and team principal assignments produce non-blocking guidance", () => {
  assert.match(actions, /Fahrerrolle gespeichert\. Für Rennanmeldung und Liga-Zuordnung/);
  assert.match(actions, /Teamchefrolle gespeichert\. Teambezogene Rechte/);
});

test("role save button follows the actual role diff", () => {
  const forms = source("components/users/UserAdminForms.tsx");
  assert.match(forms, /const hasChanges = changes\.length > 0/);
  assert.match(forms, /disabled=\{pending \|\| !hasChanges \|\| selected\.length === 0\}/);
  assert.match(forms, /Keine Änderungen/);
});

test("role update and audit share one database transaction", () => {
  assert.match(actions, /prisma\.\$transaction\(async \(transaction\)/);
  assert.match(actions, /writeSystemAudit\(transaction/);
});

test("failed transaction returns a no-partial-change response", () => {
  assert.match(actions, /keine Teiländerungen übernommen/);
});

test("updated user is reloaded inside the transaction", () => {
  assert.match(actions, /transaction\.user\.findUnique/);
  assert.match(actions, /UPDATED_USER_NOT_FOUND/);
});

test("affected administration pages are revalidated", () => {
  assert.match(actions, /revalidatePath\("\/admin\/users"\)/);
  assert.match(actions, /revalidatePath\(`\/admin\/users\/\$\{userId\}`\)/);
});

test("database session resolves the current user and roles on every request", () => {
  assert.match(adapter, /getSessionAndUser\(sessionToken\)/);
  assert.match(adapter, /include: \{ user: true \}/);
});

test("role update does not invalidate the active database session", () => {
  const roleSection = actions.slice(actions.indexOf("updateUserRolesAction"), actions.indexOf("updateUserSportAssignmentAction"));
  assert.doesNotMatch(roleSection, /session\.deleteMany/);
});

test("editing the signed-in admin cannot create a session deletion loop", () => {
  assert.doesNotMatch(actions.slice(0, actions.indexOf("updateUserSportAssignmentAction")), /deleteMany\(\{ where: \{ userId/);
});

test("direct user administration URLs remain protected", () => {
  assert.equal(hasPermission([Role.Driver], Permission.ManageUsers), false);
  assert.match(listPage, /requirePermission\(Permission\.ManageUsers\)/);
  assert.match(detailPage, /requirePermission\(Permission\.ManageUsers\)/);
});

test("mobile and desktop user management use the same loaded users", () => {
  assert.match(listPage, /users\.map\(\(user\) => <DesktopUserRow/);
  assert.match(listPage, /users\.map\(\(user\) => <MobileUserCard/);
});

test("optional relations and audit failures do not destroy the full page", () => {
  assert.match(queries, /user-detail-audit/);
  assert.match(listPage, /user-list-options/);
  assert.match(detailPage, /user-detail-options/);
});

test("migration or Prisma mismatch is diagnosed without exposing secrets", () => {
  assert.match(diagnostics, /prismaCode/);
  assert.match(diagnostics, /errorClass/);
  assert.doesNotMatch(diagnostics, /DATABASE_URL|cookie|token|secret/i);
});

test("role mutations log only safe identifiers and lifecycle phases", () => {
  assert.match(diagnostics, /actorId/);
  assert.match(diagnostics, /targetId/);
  assert.match(diagnostics, /transaction-result/);
  assert.match(diagnostics, /revalidation-result/);
  assert.doesNotMatch(diagnostics, /email|discordId|DATABASE_URL|cookie|token|secret/i);
});

test("failed role mutations provide a short error reference", () => {
  assert.match(actions, /ROLE-7F31/);
  assert.match(actions, /ROLE-2C18/);
});

test("development Prisma singleton is never disconnected during hot reload", () => {
  assert.match(prismaClient, /if \(globalForPrisma\.prisma\)/);
  assert.doesNotMatch(prismaClient, /\$disconnect/);
  assert.doesNotMatch(prismaClient, /prismaConstructor/);
});
