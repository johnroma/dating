export type UploadCapabilities = {
  guarantees: {
    /** Max bytes already hard-enforced upstream (skip local size check) */
    maxBytes?: number;
    /** Allowed MIME types already hard-enforced upstream */
    mimeWhitelist?: string[];
  };
};

/** Adapter-aware capabilities so we avoid double-guarding when a vendor already enforces things. */
export function getUploadCapabilities(): UploadCapabilities {
  // If you later wire real UploadThing, return their actual guarantees here.
  if ((process.env.UPLOAD_DRIVER ?? '').toLowerCase() === 'uploadthing') {
    const maxBytes = Number(process.env.UPLOAD_MAX_BYTES ?? 10 * 1024 * 1024);
    return {
      guarantees: {
        maxBytes,
        mimeWhitelist: ['image/jpeg', 'image/png', 'image/webp'],
      },
    };
  }
  // Local UT-style endpoint: we must enforce ourselves.
  return { guarantees: {} };
}
