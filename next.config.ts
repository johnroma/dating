import type { NextConfig } from 'next';

const config: NextConfig = (() => {
  const out: NextConfig = {};
  const cdn = process.env.CDN_BASE_URL || process.env.NEXT_PUBLIC_CDN_BASE_URL;
  if (cdn) {
    try {
      const u = new URL(cdn);
      out.images = {
        remotePatterns: [
          {
            protocol:
              (u.protocol.replace(':', '') as 'http' | 'https') || 'https',
            hostname: u.hostname,
            port: u.port || undefined,
            pathname: '/**',
          },
        ],
      };
    } catch {
      // ignore invalid URL
    }
  }
  return out;
})();

export default config;
