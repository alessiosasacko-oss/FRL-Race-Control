import { NextResponse, type NextRequest } from "next/server";

const publicRoutes = new Set([
  "/",
  "/login",
  "/offline",
  "/manifest.webmanifest",
  "/sw.js",
]);
const sessionCookieNames = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
] as const;

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (
    pathname === "/fia" ||
    pathname.startsWith("/fia/") ||
    pathname === "/attendance" ||
    pathname.startsWith("/attendance/") ||
    pathname.startsWith("/api/fia/") ||
    pathname === "/api/mobile/v1/attendance" ||
    pathname.startsWith("/api/mobile/v1/attendance/")
  ) {
    return new NextResponse("Not Found", { status: 404 });
  }

  if (
    publicRoutes.has(pathname) ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/mobile/v1/") ||
    pathname.startsWith("/api/internal/") ||
    pathname === "/api/notifications/email"
  ) {
    return NextResponse.next();
  }

  const hasSessionCookie = sessionCookieNames.some((cookieName) =>
    request.cookies.has(cookieName),
  );

  if (!hasSessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
