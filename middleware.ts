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
      const noredirect = req.nextUrl.searchParams.get("noredirect") === "1";
      if (noredirect) {
        const url = req.nextUrl.clone();
        url.pathname = "/403";
        url.searchParams.set("reason", "forbidden");
        url.searchParams.set("from", req.nextUrl.pathname);
        const res = NextResponse.rewrite(url);
        res.headers.set("x-role", role);
        return res;
      }
      const res = NextResponse.redirect(buildRedirectURL(req, "forbidden"));
      res.headers.set("x-role", role);
      return res;
    }
  }

  // Protect /moderate
  if (pathname === "/moderate" || pathname.startsWith("/moderate/")) {
    if (role !== "moderator") {
      const noredirect = req.nextUrl.searchParams.get("noredirect") === "1";
      if (noredirect) {
        const url = req.nextUrl.clone();
        url.pathname = "/403";
        url.searchParams.set("reason", "forbidden");
        url.searchParams.set("from", req.nextUrl.pathname);
        const res = NextResponse.rewrite(url);
        res.headers.set("x-role", role);
        return res;
      }
      const res = NextResponse.redirect(buildRedirectURL(req, "forbidden"));
      res.headers.set("x-role", role);
      return res;
    }
  }
  const res = NextResponse.next();
  res.headers.set("x-role", role);
  return res;
}

export const config = {
  matcher: ["/upload/:path*", "/moderate/:path*"],
};
