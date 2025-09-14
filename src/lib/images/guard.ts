export function validateDimensions(
  meta: { width?: number | null; height?: number | null },
  limits: { maxPixels: number; maxW: number; maxH: number }
): { ok: boolean; reason?: string } {
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (!w || !h) return { ok: true }; // let resize step decide later
  if (w > limits.maxW) return { ok: false, reason: 'too_wide' };
  if (h > limits.maxH) return { ok: false, reason: 'too_tall' };
  if (w * h > limits.maxPixels) return { ok: false, reason: 'too_many_pixels' };
  return { ok: true };
}
