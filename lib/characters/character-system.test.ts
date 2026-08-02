import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  backgrounds, beardStyles, bodyShapes, defaultDriverCharacter, driverCharacterConfigurationSchema,
  driverCharacterSnapshotSchema, eyeColors, eyeShapes, eyebrowStyles, eyewearStyles, faceDetails,
  faceShapes, hairColors, hairStyles, helmetModes, helmetPatterns, helmetStyles, mouthStyles,
  normalPoses, noseStyles, parseCharacterConfiguration, parseSuitConfiguration, saveDriverCharacterSchema,
  skinTones, suitPatterns, teamSuitConfigurationSchema, teamSuitTemplateInputSchema, winnerPoses,
  neutralFrlSuit,
} from "./schema";

function source(path: string) { return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8"); }
const renderer = source("components/characters/DriverCharacter.tsx");
const editor = source("components/characters/DriverCharacterEditor.tsx");
const actions = source("lib/characters/actions.ts");
const migration = source("prisma/migrations/20260802213000_driver_character_system/migration.sql");

test("1. default character validates", () => assert.equal(driverCharacterConfigurationSchema.safeParse(defaultDriverCharacter).success, true));
test("2. neutral suit validates", () => assert.equal(teamSuitConfigurationSchema.safeParse(neutralFrlSuit).success, true));
test("3. every body shape validates", () => bodyShapes.forEach((bodyShape) => assert.equal(driverCharacterConfigurationSchema.safeParse({ ...defaultDriverCharacter, bodyShape }).success, true)));
test("4. every face shape validates", () => faceShapes.forEach((faceShape) => assert.equal(driverCharacterConfigurationSchema.safeParse({ ...defaultDriverCharacter, faceShape }).success, true)));
test("5. all eight skin tones validate", () => { assert.equal(skinTones.length, 8); skinTones.forEach((skinTone) => assert.equal(driverCharacterConfigurationSchema.safeParse({ ...defaultDriverCharacter, skinTone }).success, true)); });
test("6. every eye shape validates", () => eyeShapes.forEach((eyeShape) => assert.equal(driverCharacterConfigurationSchema.safeParse({ ...defaultDriverCharacter, eyeShape }).success, true)));
test("7. every eye color validates", () => eyeColors.forEach((eyeColor) => assert.equal(driverCharacterConfigurationSchema.safeParse({ ...defaultDriverCharacter, eyeColor }).success, true)));
test("8. every eyebrow validates", () => eyebrowStyles.forEach((eyebrowStyle) => assert.equal(driverCharacterConfigurationSchema.safeParse({ ...defaultDriverCharacter, eyebrowStyle }).success, true)));
test("9. every nose validates", () => noseStyles.forEach((noseStyle) => assert.equal(driverCharacterConfigurationSchema.safeParse({ ...defaultDriverCharacter, noseStyle }).success, true)));
test("10. every mouth validates", () => mouthStyles.forEach((mouthStyle) => assert.equal(driverCharacterConfigurationSchema.safeParse({ ...defaultDriverCharacter, mouthStyle }).success, true)));
test("11. every hair style validates", () => hairStyles.forEach((hairStyle) => assert.equal(driverCharacterConfigurationSchema.safeParse({ ...defaultDriverCharacter, hairStyle }).success, true)));
test("12. every hair color validates", () => hairColors.forEach((hairColor) => assert.equal(driverCharacterConfigurationSchema.safeParse({ ...defaultDriverCharacter, hairColor }).success, true)));
test("13. every beard validates", () => beardStyles.forEach((beardStyle) => assert.equal(driverCharacterConfigurationSchema.safeParse({ ...defaultDriverCharacter, beardStyle }).success, true)));
test("14. every eyewear validates", () => eyewearStyles.forEach((eyewearStyle) => assert.equal(driverCharacterConfigurationSchema.safeParse({ ...defaultDriverCharacter, eyewearStyle }).success, true)));
test("15. every face detail validates", () => faceDetails.forEach((faceDetail) => assert.equal(driverCharacterConfigurationSchema.safeParse({ ...defaultDriverCharacter, faceDetail }).success, true)));
test("16. every normal pose validates", () => normalPoses.forEach((normalPose) => assert.equal(saveDriverCharacterSchema.safeParse({ configuration: defaultDriverCharacter, normalPose, winnerPose: "FIST_UP", suitVariantId: null }).success, true)));
test("17. every winner pose validates", () => winnerPoses.forEach((winnerPose) => assert.equal(saveDriverCharacterSchema.safeParse({ configuration: defaultDriverCharacter, normalPose: "NEUTRAL", winnerPose, suitVariantId: null }).success, true)));
test("18. every helmet style validates", () => helmetStyles.forEach((style) => assert.equal(driverCharacterConfigurationSchema.safeParse({ ...defaultDriverCharacter, helmet: { ...defaultDriverCharacter.helmet, style } }).success, true)));
test("19. every helmet pattern validates", () => helmetPatterns.forEach((pattern) => assert.equal(driverCharacterConfigurationSchema.safeParse({ ...defaultDriverCharacter, helmet: { ...defaultDriverCharacter.helmet, pattern } }).success, true)));
test("20. every helmet mode validates", () => helmetModes.forEach((mode) => assert.equal(driverCharacterConfigurationSchema.safeParse({ ...defaultDriverCharacter, helmet: { ...defaultDriverCharacter.helmet, mode } }).success, true)));
test("21. every background validates", () => backgrounds.forEach((background) => assert.equal(driverCharacterConfigurationSchema.safeParse({ ...defaultDriverCharacter, background }).success, true)));
test("22. every suit pattern validates", () => suitPatterns.forEach((pattern) => assert.equal(teamSuitConfigurationSchema.safeParse({ ...neutralFrlSuit, pattern }).success, true)));
test("23. malformed colors are rejected", () => assert.equal(teamSuitConfigurationSchema.safeParse({ ...neutralFrlSuit, primaryColor: "blue" }).success, false));
test("24. remote logo URLs are rejected", () => assert.equal(teamSuitConfigurationSchema.safeParse({ ...neutralFrlSuit, chestLogoAsset: "https://example.com/logo.svg" }).success, false));
test("25. invalid stored character falls back safely", () => assert.deepEqual(parseCharacterConfiguration({ broken: true }), defaultDriverCharacter));
test("26. invalid stored suit falls back safely", () => assert.deepEqual(parseSuitConfiguration({ broken: true }), neutralFrlSuit));
test("27. snapshots preserve character and suit", () => assert.equal(driverCharacterSnapshotSchema.safeParse({ version: 1, characterVersion: 2, configuration: defaultDriverCharacter, normalPose: "NEUTRAL", winnerPose: "TROPHY", driverNumber: 16, flag: "🇮🇹", teamSuit: neutralFrlSuit, suitTemplateId: null }).success, true));
test("28. suit templates require an organization", () => assert.equal(teamSuitTemplateInputSchema.safeParse({ name: "A", configuration: neutralFrlSuit, active: true, displayOrder: 0 }).success, false));
test("29. renderer is a local layered SVG with all required variants", () => { assert.match(renderer, /<svg/); assert.match(renderer, /data-layer="body"/); assert.match(renderer, /"fullBody" \| "portrait" \| "tableThumbnail" \| "winner" \| "dashboardHero"/); assert.doesNotMatch(renderer, /href=["']https?:\/\//); });
test("30. editor and actions are mobile-safe and ownership-protected", () => { assert.match(editor, /grid min-w-0/); assert.match(editor, /min-h-11/); assert.match(editor, /lg:grid-cols/); assert.match(actions, /requireAuthenticatedUser/); assert.match(actions, /organizationId/); assert.match(migration, /"characterSnapshot" JSONB/); });
