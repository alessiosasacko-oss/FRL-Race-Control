type AuthErrorDetails = Error & {
  type?: string;
  cause?: Record<string, unknown> & {
    err?: unknown;
    error?: unknown;
    provider?: unknown;
    status?: unknown;
  };
};

function safeIdentifier(value: unknown): string | undefined {
  return typeof value === "string" &&
    value.length <= 80 &&
    /^[A-Za-z0-9_-]+$/.test(value)
    ? value
    : undefined;
}

function safeHttpStatus(value: unknown): number | undefined {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 100 &&
    value <= 599
    ? value
    : undefined;
}

const oauthResponseFields = [
  "access_token",
  "token_type",
  "expires_in",
  "refresh_token",
  "scope",
  "id_token",
  "error",
  "error_description",
  "code",
  "message",
] as const;

function safeOAuthResponseDetails(value: unknown): {
  responseFields?: readonly string[];
  oauthErrorCode?: string;
  oauthResponseCode?: number;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const response = value as Record<string, unknown>;
  const responseFields = oauthResponseFields.filter((field) => field in response);

  return {
    responseFields: responseFields.length > 0 ? responseFields : undefined,
    oauthErrorCode: safeIdentifier(response.error),
    oauthResponseCode:
      typeof response.code === "number" &&
      Number.isSafeInteger(response.code)
        ? response.code
        : undefined,
  };
}

function safeOAuthFailureReason(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined;

  // OAuth4WebAPI messages are reduced to a fixed vocabulary. The original
  // text may contain provider-controlled data and is never emitted.
  const reasons: Record<string, string> = {
    'no authorization code in "callbackParameters"': "authorization_code_missing",
    '"code" parameter must be provided only once': "authorization_code_duplicate",
    'response parameter "state" missing': "oauth_state_missing",
    'unexpected "state" response parameter value': "oauth_state_mismatch",
    'unexpected "state" response parameter encountered': "oauth_state_unexpected",
    '"response" body "access_token" property must not be empty': "token_access_token_empty",
    '"response" body "access_token" property must be a string': "token_access_token_missing",
    '"response" body "token_type" property must not be empty': "token_type_empty",
    '"response" body "token_type" property must be a string': "token_type_missing",
    '"response" body "scope" property must be a string': "token_scope_invalid",
    '"response" body must be a top level object': "token_body_not_object",
  };

  return reasons[error.message];
}

function nestedErrorDetails(error: unknown): {
  name?: string;
  code?: string;
  prismaCode?: string;
  modelName?: string;
  httpStatus?: number;
  oauthErrorCode?: string;
  oauthResponseFields?: readonly string[];
  oauthResponseCode?: number;
  oauthFailureReason?: string;
} {
  if (!(error instanceof Error)) return {};

  const nested = error as Error & {
    code?: unknown;
    meta?: { modelName?: unknown };
    status?: unknown;
    response?: { status?: unknown };
    error?: unknown;
    cause?: unknown;
  };
  const nestedCause =
    nested.cause && typeof nested.cause === "object"
      ? (nested.cause as {
          code?: unknown;
          status?: unknown;
          error?: unknown;
          body?: unknown;
        })
      : undefined;
  const code =
    safeIdentifier(nested.code) ??
    safeIdentifier(nestedCause?.code);

  const response = safeOAuthResponseDetails(nestedCause?.body);

  return {
    name: nested.name,
    code,
    prismaCode:
      code && /^P\d{4}$/.test(code) ? code : undefined,
    modelName: safeIdentifier(nested.meta?.modelName),
    httpStatus:
      safeHttpStatus(nested.status) ??
      safeHttpStatus(nested.response?.status) ??
      safeHttpStatus(nestedCause?.status),
    oauthErrorCode:
      safeIdentifier(nested.error) ??
      safeIdentifier(nestedCause?.error) ??
      response.oauthErrorCode,
    oauthResponseFields: response.responseFields,
    oauthResponseCode: response.oauthResponseCode,
    oauthFailureReason: safeOAuthFailureReason(nested),
  };
}

function failedPhase(
  authErrorType: string,
  modelName: string | undefined,
  systemErrorCode: string | undefined,
): string {
  if (authErrorType === "AdapterError") {
    if (modelName === "Session") return "session_database";
    if (modelName === "Account") return "account_persistence";
    if (modelName === "User") return "user_persistence";
    return "prisma_adapter";
  }
  if (authErrorType === "SessionTokenError") {
    return "session_lookup";
  }
  if (authErrorType === "OAuthAccountNotLinked") {
    return "account_linking";
  }
  if (authErrorType === "OAuthProfileParseError") {
    return "discord_profile";
  }
  if (
    authErrorType === "CallbackRouteError" &&
    systemErrorCode
  ) {
    return "oauth_token_exchange";
  }
  if (authErrorType === "CallbackRouteError") {
    return "oauth_callback";
  }
  return "auth_request";
}

export function safeAuthErrorDetails(
  error: unknown,
): Record<string, unknown> {
  if (!(error instanceof Error)) {
    return {};
  }

  const authError = error as AuthErrorDetails;
  const cause = authError.cause;
  const authErrorType =
    safeIdentifier(authError.type) ?? authError.name;
  const hasNestedError = cause?.err instanceof Error;
  const nested = nestedErrorDetails(
    hasNestedError ? cause.err : error,
  );
  const systemErrorCode =
    nested.code && !nested.prismaCode ? nested.code : undefined;
  const oauthErrorCode =
    safeIdentifier(cause?.error) ?? nested.oauthErrorCode;

  return {
    authErrorType,
    failedPhase: failedPhase(
      authErrorType,
      nested.modelName,
      systemErrorCode,
    ),
    causeErrorName: hasNestedError ? nested.name : undefined,
    oauthErrorCode,
    httpStatus: safeHttpStatus(cause?.status) ?? nested.httpStatus,
    prismaErrorCode: nested.prismaCode,
    systemErrorCode,
    modelName: nested.modelName,
    provider: safeIdentifier(cause?.provider),
    oauthResponseFields: nested.oauthResponseFields,
    oauthResponseCode: nested.oauthResponseCode,
    oauthFailureReason: nested.oauthFailureReason,
  };
}
