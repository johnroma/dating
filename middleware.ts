import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { COOKIE_NAME } from '@/src/lib/role-cookie';
import { parseRole } from '@/src/lib/roles';

// Lightweight parse of sess cookie (no HMAC verify in middleware to keep edge-friendly)
function parseSessCookie(
  req: NextRequest
): { role: 'user' | 'moderator' } | null {
  const cookie = req.cookies.get('sess')?.value;
  if (!cookie) return null;
  const [payload] = cookie.split('.');
  if (!payload) return null;
  try {
    const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (json && (json.role === 'user' || json.role === 'moderator')) {
      return { role: json.role };
    }
  } catch {
    // ignore malformed cookies
  }
  return null;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const sess = parseSessCookie(req); // new
  const legacy = req.cookies.get(COOKIE_NAME)?.value || ''; // old
  const roleLegacy = parseRole(legacy);

  // public paths
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/mock') ||
    pathname.startsWith('/mock-cdn')
  ) {
    return NextResponse.next();
  }
  if (pathname.startsWith('/dev/login')) return NextResponse.next();

  // /upload : allow user or moderator (new), or creator/moderator (legacy)
  if (pathname.startsWith('/upload')) {
    if (
      sess?.role === 'user' ||
      sess?.role === 'moderator' ||
      roleLegacy === 'creator' ||
      roleLegacy === 'moderator'
    ) {
      return NextResponse.next();
    }
    const url = req.nextUrl.clone();
    url.pathname = '/dev/login';
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }

  // /moderate : allow only moderator
  if (pathname.startsWith('/moderate')) {
    if (sess?.role === 'moderator' || roleLegacy === 'moderator')
      return NextResponse.next();
    const url = req.nextUrl.clone();
    url.pathname = '/dev/login';
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/upload/:path*', '/moderate/:path*', '/((?!_next|mock-cdn).*)'],
};
