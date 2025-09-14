export type Sniff =
  | { ok: true; type: 'image/jpeg' | 'image/png' | 'image/webp' }
  | { ok: false; reason: string };

export function sniffImage(buf: Buffer): Sniff {
  if (buf.length < 12) return { ok: false, reason: 'too_small' };
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ok: true, type: 'image/jpeg' };
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((b, i) => buf[i] === b)) {
    return { ok: true, type: 'image/png' };
  }
  // WEBP: "RIFF"...."WEBP"
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return { ok: true, type: 'image/webp' };
  }
  return { ok: false, reason: 'unsupported_magic_bytes' };
}
