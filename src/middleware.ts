import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/authStore";

const SESSION_COOKIE = "codcrm_session";

// Routes that are always public
const PUBLIC_PATHS = ["/login"];

// API routes that are public
const PUBLIC_API_PREFIXES = [
  "/api/webhooks",
  "/api/lp-submit",
  "/api/lp-pages",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow static assets
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon.ico") ||
    /\.(svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Public landing pages: /lp/[slug]
  if (pathname.startsWith("/lp/")) {
    return NextResponse.next();
  }

  // Public API prefixes
  for (const prefix of PUBLIC_API_PREFIXES) {
    if (pathname.startsWith(prefix)) {
      return NextResponse.next();
    }
  }

  // Public pages
  for (const p of PUBLIC_PATHS) {
    if (pathname === p || pathname.startsWith(p + "/")) {
      return NextResponse.next();
    }
  }

  // Check session cookie
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  const user = getSession(token);
  if (!user || !user.active) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
