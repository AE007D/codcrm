import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "codcrm_session";

// Routes that are always public
const PUBLIC_PATHS = ["/login"];

// API routes that are public (no auth needed)
const PUBLIC_API_PREFIXES = [
  "/api/webhooks",
  "/api/lp-submit",
  "/api/lp-pages",
  "/api/auth",   // all auth endpoints are public
];

export function proxy(request: NextRequest) {
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

  // Optimistic check: just verify the cookie exists.
  // Real session validation happens inside each API/page route.
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
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
