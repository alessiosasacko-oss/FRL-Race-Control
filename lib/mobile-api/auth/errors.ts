export class MobileAuthError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "MobileAuthError";
  }
}

export function invalidRequest(
  code = "INVALID_REQUEST",
  message = "Die Anfrage ist ungültig.",
): MobileAuthError {
  return new MobileAuthError(400, code, message);
}

export function unauthorized(
  code = "UNAUTHORIZED",
  message = "Die Mobile-Sitzung ist nicht gültig.",
): MobileAuthError {
  return new MobileAuthError(401, code, message);
}

export function forbidden(
  code = "ACCOUNT_NOT_ALLOWED",
  message = "Dein Discord-Account ist noch nicht für FRL Race Control freigeschaltet.",
): MobileAuthError {
  return new MobileAuthError(403, code, message);
}
