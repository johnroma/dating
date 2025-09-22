// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

function saveEnv() {
  const copy = { ...process.env };
  return () => {
    process.env = { ...copy };
  };
}

describe('ingest route in R2 mode', () => {
  let restoreEnv: () => void;

  beforeEach(() => {
    restoreEnv = saveEnv();
    process.env.VERCEL = '1'; // simulate vercel
    process.env.STORAGE_DRIVER = 'r2'; // R2 mode
    process.env.S3_BUCKET_ORIG = 'bucket';
    process.env.S3_BUCKET_CDN = 'cdn';
    process.env.S3_ENDPOINT = 'https://example.r2.cloudflarestorage.com';
  });

  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    restoreEnv();
  });

  it('does NOT read from local disk when STORAGE_DRIVER=r2', async () => {
    // Track if any filesystem read operations were called
    let fsReadCalled = false;

    // Mock the entire fs module to detect any read operations
    vi.mock('node:fs', () => ({
      promises: {
        readFile: vi.fn().mockImplementation(() => {
          fsReadCalled = true;
          throw new Error('Should not read from filesystem in R2 mode');
        }),
      },
      readFileSync: vi.fn().mockImplementation(() => {
        fsReadCalled = true;
        throw new Error('Should not read from filesystem in R2 mode');
      }),
      createReadStream: vi.fn().mockImplementation(() => {
        fsReadCalled = true;
        throw new Error('Should not read from filesystem in R2 mode');
      }),
    }));

    // Mock storage port - this is what should be used instead of filesystem
    vi.mock('@/src/ports/storage', () => ({
      getStorage: async () => ({
        readOriginalBuffer: vi
          .fn()
          .mockResolvedValue(Buffer.from('mock-image-data')),
        putOriginal: vi.fn(),
        putVariant: vi
          .fn()
          .mockResolvedValue('https://cdn.example.com/test/sm.webp'),
        getOriginalPresignedUrl: vi.fn(),
        deleteAllForPhoto: vi.fn(),
        variantsBaseUrl: vi.fn().mockReturnValue('https://cdn.example.com'),
      }),
    }));

    // Mock other dependencies
    vi.mock('@/src/lib/db', () => ({
      getDb: () => ({
        insertPhoto: vi.fn(),
        updatePhoto: vi.fn(),
      }),
    }));

    vi.mock('@/src/lib/quotas', () => ({
      enforceQuotaOrThrow: vi.fn(),
      getRoleQuota: vi.fn().mockReturnValue({ uploads: 100 }),
      getUsage: vi.fn().mockReturnValue({ uploads: 0 }),
    }));

    vi.mock('@/src/lib/rate/limiter', () => ({
      ipFromHeaders: vi.fn().mockReturnValue('127.0.0.1'),
      limit: vi.fn().mockReturnValue(true),
    }));

    // Mock Sharp to avoid image processing complexity
    vi.mock('sharp', () => ({
      default: vi.fn().mockImplementation(() => ({
        metadata: vi.fn().mockResolvedValue({ width: 100, height: 100 }),
        rotate: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        webp: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(Buffer.from('mock-webp-data')),
      })),
    }));

    // Mock session to allow member role for ingest
    vi.mock('@/src/ports/auth', () => ({
      getSession: vi
        .fn()
        .mockResolvedValue({ userId: 'test-member', role: 'member' }),
      setSession: vi.fn(),
      clearSession: vi.fn(),
    }));

    // Import the route AFTER mocks & env are in place
    const { POST } = await import('@/app/api/photos/ingest/route');

    // Build a request
    const body = { key: 'foo.png' };
    const req = new Request('http://test.local/api/photos/ingest', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    const res = await POST(req);

    // The key assertion: no filesystem reads should have occurred
    expect(fsReadCalled).toBe(false);
    expect(res.ok).toBe(true);
  });
});
