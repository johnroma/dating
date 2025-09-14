// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { makeVariants } from '../src/lib/images/resize';
import { ORIG, ROOT } from '../src/lib/storage/fs';
import sharp from 'sharp';

const TMP_DB = path.join(process.cwd(), '.data/db/test.db');
const PHOTO_ID = `t-${Date.now()}`;

async function makeTinyPng() {
  return await sharp({
    create: { width: 2, height: 2, channels: 3, background: { r: 255, g: 0, b: 0 } },
  })
    .png()
    .toBuffer();
}

beforeAll(async () => {
  process.env.DB_DRIVER = 'sqlite';
  process.env.DATABASE_FILE = TMP_DB;
  // ensure ORIG dir exists
  const origDir = path.join(process.cwd(), ORIG);
  fs.mkdirSync(origDir, { recursive: true });
  fs.writeFileSync(path.join(origDir, 'tiny.png'), await makeTinyPng());
});

afterAll(() => {
  try {
    fs.rmSync(path.join(process.cwd(), ROOT), { recursive: true, force: true });
  } catch {}
});

it('creates webp variants and strips exif', async () => {
  const origAbs = path.join(process.cwd(), ORIG, 'tiny.png');
  const { sizesJson } = await makeVariants({ photoId: PHOTO_ID, origAbsPath: origAbs });

  const paths = ['sm', 'md', 'lg'].map(size => {
    const p = sizesJson[size];
    expect(p).toMatch(new RegExp(`${PHOTO_ID}/${size}\.webp$`));
    const abs = path.join(process.cwd(), '.data/storage/photos-cdn', PHOTO_ID, `${size}.webp`);
    expect(fs.existsSync(abs)).toBe(true);
    const b = fs.readFileSync(abs);
    // RIFF....WEBP header
    expect(b.slice(0, 4).toString('ascii')).toBe('RIFF');
    expect(b.slice(8, 12).toString('ascii')).toBe('WEBP');
    // No EXIF string inside
    expect(b.toString('ascii').includes('Exif')).toBe(false);
    return abs;
  });
  expect(paths.length).toBe(3);
});
