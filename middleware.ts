import { NextResponse, type NextRequest } from "next/server";

import { parseRole } from "./src/lib/roles";

function buildRedirectURL(req: NextRequest, reason: string) {
  const url = req.nextUrl.clone();
  url.pathname = "/dev/role";
  url.searchParams.set("reason", reason);
  url.searchParams.set("from", req.nextUrl.pathname);
  return url;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const role = parseRole(req.cookies.get("role")?.value);

  // Protect /upload
  if (pathname === "/upload" || pathname.startsWith("/upload/")) {
    if (!(role === "creator" || role === "moderator")) {
      return NextResponse.redirect(buildRedirectURL(req, "forbidden"));
    }
  }

  // Protect /moderate
  if (pathname === "/moderate" || pathname.startsWith("/moderate/")) {
    if (role !== "moderator") {
      return NextResponse.redirect(buildRedirectURL(req, "forbidden"));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/upload/:path*", "/moderate/:path*"],
};

