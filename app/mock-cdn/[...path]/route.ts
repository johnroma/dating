/* Make this route Edge in prod (R2) and Node only in local dev.
 * In prod we return 410 (variants live on R2), so no heavy deps get bundled.
 */
import { NextResponse } from 'next/server';

import { localCdnRoot } from '@/src/lib/storage/paths';

export const dynamic = 'force-dynamic';
// At build time, Next inlines process.env.*; the unused branch is dead-code-eliminated.
// Note: Next requires segment config to be static. Use Node runtime
// and short‑circuit to 410 in prod so heavy deps are never used.
export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ path: string[] }> }
) {
  // PRODUCTION (R2): never serve from /mock-cdn — variants are on CDN_BASE_URL.
  if ((process.env.STORAGE_DRIVER || 'local') !== 'local') {
    return new NextResponse(null, {
      status: 410,
      headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
    });
  }

  // LOCAL DEV: stream the prebuilt WebP from disk (no sharp).
  const { join } = await import('node:path');
  const { createReadStream, statSync } = await import('node:fs');

  const { path: segs } = await ctx.params;
  const [photoId, file] = [segs?.[0], segs?.[1]]; // e.g. sm.webp | md.webp | lg.webp
  if (!photoId || !file) {
    return NextResponse.json({ error: 'bad path' }, { status: 400 });
  }

  // Enforce status: only APPROVED are publicly served for non-moderators
  try {
    const [{ getDb }, { COOKIE_NAME }, { parseRole }] = await Promise.all([
      import('@/src/lib/db'),
      import('@/src/lib/role-cookie'),
      import('@/src/lib/roles'),
    ]);
    const db = getDb();
    const photo = await db.getPhoto(photoId);
    const cookie = _req.headers.get('cookie') || '';
    const roleCookie = cookie
      .split(/;\s*/)
      .map(kv => kv.split('='))
      .find(([k]) => k === COOKIE_NAME)?.[1];
    const role = parseRole(roleCookie);
    const isModerator = role === 'moderator';
    if (
      !photo ||
      photo.deletedat ||
      (photo.status !== 'APPROVED' && !isModerator)
    ) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
  } catch {
    // If anything goes wrong enforcing, fall through to 404/serve from disk
  }

  const root = localCdnRoot();
  const abs = join(root, photoId, file);
  try {
    const st = statSync(abs);
    const nodeStream = createReadStream(abs);

    // Convert Node.js ReadStream to web-compatible ReadableStream
    const webStream = new ReadableStream({
      start(controller) {
        nodeStream.on('data', chunk => controller.enqueue(chunk));
        nodeStream.on('end', () => controller.close());
        nodeStream.on('error', error => controller.error(error));
      },
      cancel() {
        nodeStream.destroy();
      },
    });

    const res = new NextResponse(webStream, {
      headers: {
        'Content-Type': 'image/webp',
        'Content-Length': String(st.size),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
    if (process.env.DEBUG_MOCK_CDN === '1') {
      res.headers.set('x-cdn-root', root);
      res.headers.set('x-cdn-abs', abs);
      res.headers.set('x-cdn-exists', '1');
    }

    return res;
  } catch {
    const res = new NextResponse(null, { status: 404 });
    if (process.env.DEBUG_MOCK_CDN === '1') {
      res.headers.set('x-cdn-root', root);
      res.headers.set('x-cdn-abs', abs);
      res.headers.set('x-cdn-exists', '0');
    }
    return res;
  }
}
