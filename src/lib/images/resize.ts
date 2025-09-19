import fs from 'node:fs';
import path from 'node:path';

import sharp from 'sharp';

import { variantPath } from '@/src/lib/storage/fs';

export const SIZES: Record<'sm' | 'md' | 'lg', number> = {
  sm: 256,
  md: 768,
  lg: 1536,
};

export async function makeVariants(args: {
  photoId: string;
  origAbsPath: string;
}): Promise<{
  sizesJson: Record<string, string>;
  width: number;
  height: number;
}> {
  const { photoId, origAbsPath } = args;

  const input = sharp(origAbsPath, { unlimited: true });
  const meta = await input.metadata();
  const width = Math.round(meta.width || 0);
  const height = Math.round(meta.height || 0);

  const storageDriver = process.env.STORAGE_DRIVER || 'local';
  const base =
    storageDriver === 'r2'
      ? process.env.CDN_BASE_URL || '/mock-cdn'
      : process.env.NEXT_PUBLIC_CDN_BASE_URL || '/mock-cdn';

  const entries: Array<['sm' | 'md' | 'lg', number]> = [
    ['sm', SIZES.sm],
    ['md', SIZES.md],
    ['lg', SIZES.lg],
  ];

  await Promise.all(
    entries.map(async ([label, max]) => {
      const buf = await sharp(origAbsPath)
        .rotate()
        .resize({
          width: max,
          height: max,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 75 })
        .toBuffer();
      const outAbs = variantPath(photoId, label);
      const dir = path.dirname(outAbs);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      await fs.promises.writeFile(outAbs, buf);
    })
  );

  const sizesJson: Record<string, string> = {
    sm: `${base}/${photoId}/sm.webp`,
    md: `${base}/${photoId}/md.webp`,
    lg: `${base}/${photoId}/lg.webp`,
  };

  return { sizesJson, width, height };
}
