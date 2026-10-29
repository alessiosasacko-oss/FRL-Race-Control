import assert from "node:assert/strict";
import test from "node:test";
import { safeAuthErrorDetails } from "./logging-details";

function authError(
  type: string,
  nested: Error,
  extraCause: Record<string, unknown> = {},
): Error {
  const error = new Error("Sensitive upstream message") as Error & {
    type: string;
    cause: Record<string, unknown>;
  };
  error.type = type;
  error.cause = {
    err: nested,
    provider: "discord",
    ...extraCause,
  };
  return error;
}

test("reports Prisma adapter failures without error messages", () => {
  const nested = new Error("Sensitive database detail") as Error & {
    code: string;
    meta: { modelName: string };
  };
  nested.name = "PrismaClientKnownRequestError";
  nested.code = "P2002";
  nested.meta = { modelName: "Account" };

  assert.deepEqual(
    safeAuthErrorDetails(authError("AdapterError", nested)),
    {
      authErrorType: "AdapterError",
      failedPhase: "account_persistence",
      causeErrorName: "PrismaClientKnownRequestError",
      oauthErrorCode: undefined,
      oauthResponseFields: undefined,
      oauthResponseCode: undefined,
      httpStatus: undefined,
      prismaErrorCode: "P2002",
      systemErrorCode: undefined,
      modelName: "Account",
      provider: "discord",
    },
  );
});

test("reports direct Prisma failures without their message", () => {
  const error = new Error("Sensitive database detail") as Error & {
    code: string;
    meta: { modelName: string };
  };
  error.name = "PrismaClientKnownRequestError";
  error.code = "P2025";
  error.meta = { modelName: "User" };

  const details = safeAuthErrorDetails(error);
  assert.equal(details.prismaErrorCode, "P2025");
  assert.equal(details.modelName, "User");
  assert.equal(JSON.stringify(details).includes(error.message), false);
});

test("classifies callback network failures as token exchange", () => {
  const nested = new TypeError("Network access denied") as TypeError & {
    cause: { code: string };
  };
  nested.cause = { code: "EACCES" };

  const details = safeAuthErrorDetails(
    authError("CallbackRouteError", nested),
  );
  assert.equal(details.failedPhase, "oauth_token_exchange");
  assert.equal(details.systemErrorCode, "EACCES");
  assert.equal(details.prismaErrorCode, undefined);
});

test("reports safe OAuth codes and HTTP status", () => {
  const details = safeAuthErrorDetails(
    authError("CallbackRouteError", new Error("Denied"), {
      error: "access_denied",
      status: 400,
    }),
  );

  assert.equal(details.oauthErrorCode, "access_denied");
  assert.equal(details.httpStatus, 400);
  assert.equal(details.failedPhase, "oauth_callback");
});

test("never exposes nested messages or unsafe identifiers", () => {
  const nested = new Error("contains access token and credentials");
  const details = safeAuthErrorDetails(
    authError("CallbackRouteError", nested, {
      error: "unsafe value with spaces",
      provider: "discord?token=hidden",
    }),
  );
  const serialized = JSON.stringify(details);

  assert.equal(serialized.includes("access token"), false);
  assert.equal(serialized.includes("credentials"), false);
  assert.equal(details.oauthErrorCode, undefined);
  assert.equal(details.provider, undefined);
});

test("reports only safe OAuth response metadata", () => {
  const nested = new Error("raw token response") as Error & {
    code: string;
    cause: {
      body: {
        access_token: string;
        token_type: string;
        error: string;
        error_description: string;
        code: number;
        message: string;
      };
    };
  };
  nested.code = "OAUTH_INVALID_RESPONSE";
  nested.cause = {
    body: {
      access_token: "must-never-be-logged",
      token_type: "Bearer",
      error: "invalid_client",
      error_description: "Sensitive credential explanation",
      code: 0,
      message: "Raw upstream message",
    },
  };

  const details = safeAuthErrorDetails(
    authError("CallbackRouteError", nested),
  );
  const serialized = JSON.stringify(details);

  assert.equal(details.oauthErrorCode, "invalid_client");
  assert.deepEqual(details.oauthResponseFields, [
    "access_token",
    "token_type",
    "error",
    "error_description",
    "code",
    "message",
  ]);
  assert.equal(details.oauthResponseCode, 0);
  assert.equal(serialized.includes("must-never-be-logged"), false);
  assert.equal(serialized.includes("Sensitive credential explanation"), false);
  assert.equal(serialized.includes("Raw upstream message"), false);
});
