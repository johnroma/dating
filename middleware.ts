import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Parse `sess` cookie (dev session) without verifying HMAC here (edge-friendly)
function parseSessCookie(
  req: NextRequest
): { role: 'viewer' | 'creator' | 'moderator' } | null {
  const raw = req.cookies.get('sess')?.value;
  if (!raw) return null;
  const [payload] = raw.split('.');
  if (!payload) return null;
  try {
    const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (
      json &&
      (json.role === 'viewer' ||
        json.role === 'creator' ||
        json.role === 'moderator')
    )
      return { role: json.role };
  } catch {
    // Ignore parsing errors for session cookie
  }
  return null;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const sess = parseSessCookie(req);

  // public paths
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/mock') ||
    pathname.startsWith('/mock-cdn')
  ) {
    return NextResponse.next();
  }
  if (pathname.startsWith('/dev/login')) return NextResponse.next();

  // /upload : allow creator or moderator
  if (pathname.startsWith('/upload')) {
    if (sess?.role === 'creator' || sess?.role === 'moderator')
      return NextResponse.next();
    const url = req.nextUrl.clone();
    url.pathname = '/dev/login';
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }

  // /moderate : allow only moderator
  if (pathname.startsWith('/moderate')) {
    if (sess?.role === 'moderator') return NextResponse.next();
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
