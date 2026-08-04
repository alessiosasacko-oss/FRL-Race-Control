export class MobileApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "MobileApiError";
  }
}

export function badRequest(code: string, message: string): MobileApiError {
  return new MobileApiError(400, code, message);
}

export function notFound(code: string, message: string): MobileApiError {
  return new MobileApiError(404, code, message);
}
