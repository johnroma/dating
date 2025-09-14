export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { CDN, readStream, exists } from '@/src/lib/storage/fs';
import path from 'node:path';
import fs from 'node:fs';

export async function GET(_: Request, ctx: { params: { path: string[] } }) {
  const abs = path.join(process.cwd(), CDN, ...(ctx.params.path || []));
  if (!exists(abs))
    return NextResponse.json({ error: 'not found' }, { status: 404 });

  const stat = fs.statSync(abs);
  const res = new Response(readStream(abs) as any, {
    headers: {
      'Content-Type': 'image/webp',
      'Content-Length': String(stat.size),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
  return res;
}

