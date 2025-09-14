/* Make this route Edge in prod (R2) and Node only in local dev.
 * In prod we return 410 (variants live on R2), so no heavy deps get bundled.
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
// At build time, Next inlines process.env.*; the unused branch is dead-code-eliminated.
export const runtime = (
  (process.env.STORAGE_DRIVER || 'local') === 'local' ? 'nodejs' : 'edge'
) as 'nodejs' | 'edge';

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
  const { Readable } = await import('node:stream');

  const { path: segs } = await ctx.params;
  const [photoId, file] = [segs?.[0], segs?.[1]]; // e.g. sm.webp | md.webp | lg.webp
  if (!photoId || !file) {
    return NextResponse.json({ error: 'bad path' }, { status: 400 });
  }

  const abs = join(
    process.cwd(),
    '.data',
    'storage',
    'photos-cdn',
    photoId,
    file
  );
  try {
    const st = statSync(abs);
    const nodeStream = createReadStream(abs);
    const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;
    return new NextResponse(webStream, {
      headers: {
        'Content-Type': 'image/webp',
        'Content-Length': String(st.size),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
