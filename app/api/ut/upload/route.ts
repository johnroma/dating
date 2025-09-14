export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { writeOriginal } from '@/src/lib/storage/fs';
import { v4 as uuid } from 'uuid';
import mime from 'mime';

const MAX_BYTES = Number(process.env.UPLOAD_MAX_BYTES || 10 * 1024 * 1024);
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'no file' }, { status: 400 });

  const type = (file as any).type || 'application/octet-stream';
  if (!ALLOWED.has(type))
    return NextResponse.json({ error: 'bad mime' }, { status: 415 });

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.byteLength > MAX_BYTES)
    return NextResponse.json({ error: 'too large' }, { status: 413 });

  const ext = mime.getExtension(type) || 'bin';
  const key = `${uuid()}.${ext}`;

  await writeOriginal(key, buf);
  return NextResponse.json({ key });
}
