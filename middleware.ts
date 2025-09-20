import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Parse session cookies for both dev and Supabase auth
function parseSessionCookie(
  req: NextRequest
): { role: 'viewer' | 'member' | 'admin' } | null {
  // Check for dev session cookie first
  const devSess = req.cookies.get('sess')?.value;
  if (devSess) {
    const [payload] = devSess.split('.');
    if (payload) {
      try {
        const json = JSON.parse(
          Buffer.from(payload, 'base64url').toString('utf8')
        );
        if (
          json &&
          (json.role === 'viewer' ||
            json.role === 'member' ||
            json.role === 'admin')
        )
          return { role: json.role };
      } catch {
        // Ignore parsing errors for dev session cookie
      }
    }
  }

  const adminEmails =
    process.env.SUPABASE_ADMIN_EMAILS?.split(',')
      .map(email => email.trim().toLowerCase())
      .filter(Boolean) || [];

  // Check for Supabase session cookies
  const supabaseToken = req.cookies.get('sb-access-token')?.value;
  const supabaseEmailCookie =
    req.cookies.get('sb-user-email')?.value?.toLowerCase() || null;

  if (supabaseToken) {
    // For Supabase, we need to do a quick JWT decode without verification
    // This is not ideal but necessary for edge middleware
    try {
      const [, payload] = supabaseToken.split('.');
      if (payload) {
        const decoded = JSON.parse(
          Buffer.from(payload, 'base64url').toString('utf8')
        );
        const tokenEmail = (decoded.email || decoded.user_metadata?.email || '')
          .toString()
          .toLowerCase();
        const email = tokenEmail || supabaseEmailCookie;

        if (
          process.env.DB_DRIVER?.toLowerCase() === 'postgres' &&
          process.env.NODE_ENV === 'production'
        ) {
          // In production with PostgreSQL we can't hit the database from middleware;
          // fall back to cookie-based role mapping.
          if (email && adminEmails.includes(email)) {
            return { role: 'admin' };
          }
          return null;
        }

        if (email && adminEmails.includes(email)) {
          return { role: 'admin' };
        }

        if (email) {
          return { role: 'member' };
        }
      }
    } catch {
      // Ignore JWT parsing errors
    }
  }

  if (supabaseEmailCookie) {
    if (adminEmails.includes(supabaseEmailCookie)) {
      return { role: 'admin' };
    }
    return { role: 'member' };
  }

  return null;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const sess = parseSessionCookie(req);

  // public paths
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/mock') ||
    pathname.startsWith('/mock-cdn')
  ) {
    return NextResponse.next();
  }
  if (
    pathname.startsWith('/dev/login') ||
    pathname.startsWith('/dev/sb-login') ||
    pathname.startsWith('/auth/callback')
  ) {
    return NextResponse.next();
  }

  // /upload : allow member or admin
  if (pathname.startsWith('/upload')) {
    if (sess?.role === 'member' || sess?.role === 'admin')
      return NextResponse.next();
    const url = req.nextUrl.clone();
    url.pathname = '/dev/login';
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }

  // /moderate : allow only admin
  if (pathname.startsWith('/moderate')) {
    if (sess?.role === 'admin') return NextResponse.next();
    const url = req.nextUrl.clone();
    url.pathname = '/dev/login';
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }

  // /me : allow member or admin
  if (pathname.startsWith('/me')) {
    if (sess?.role === 'member' || sess?.role === 'admin')
      return NextResponse.next();
    const url = req.nextUrl.clone();
    url.pathname = '/dev/sb-login';
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/upload/:path*',
    '/moderate/:path*',
    '/me/:path*',
    '/((?!_next|mock-cdn|api|dev|auth).*)',
  ],
};
