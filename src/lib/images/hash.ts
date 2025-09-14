import sharp from 'sharp';

/** 64-bit dHash as 16-char hex (8x8 comparisons). */
export async function dHashHex(buf: Buffer): Promise<string> {
  const raw = await sharp(buf)
    .grayscale()
    .resize(9, 8, { fit: 'fill' })
    .raw()
    .toBuffer();
  let bits = 0n;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const iL = y * 9 + x;
      const iR = iL + 1;
      const bit = raw[iL] > raw[iR] ? 1n : 0n;
      bits = (bits << 1n) | bit;
    }
  }
  return bits.toString(16).padStart(16, '0');
}

export function hamming(aHex: string, bHex: string): number {
  // Validate hex strings
  if (!isValidHex(aHex) || !isValidHex(bHex)) {
    return Infinity; // Return max distance for invalid hex strings
  }

  const a = BigInt(`0x${aHex}`);
  const b = BigInt(`0x${bHex}`);
  let x = a ^ b;
  let c = 0;
  while (x) {
    x &= x - 1n;
    c++;
  }
  return c;
}

function isValidHex(str: string): boolean {
  return /^[0-9a-fA-F]+$/.test(str);
}
