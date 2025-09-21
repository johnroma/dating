/* eslint-disable promise/prefer-await-to-callbacks */
import type { NextConfig } from 'next';

const config: NextConfig = (() => {
  const out: NextConfig = {};
  const cdn = process.env.CDN_BASE_URL;
  if (cdn) {
    try {
      const u = new URL(cdn);
      out.images = {
        remotePatterns: [
          {
            protocol: u.protocol.replace(':', '') as 'http' | 'https',
            hostname: u.hostname,
            port: u.port || undefined,
            pathname: '/cdn/**',
          },
          {
            protocol: u.protocol.replace(':', '') as 'http' | 'https',
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
  // Exclude heavy native deps from output file tracing to keep bundles slim
  (
    out as unknown as { outputFileTracingExcludes?: Record<string, string[]> }
  ).outputFileTracingExcludes = {
    '*': ['**/better-sqlite3/**'],
  };
  // Ensure optional native modules are treated as externals when not referenced.
  // This helps avoid accidentally bundling them into API functions.
  out.webpack = (config, { isServer }) => {
    if (isServer) {
      (config.externals ?? (config.externals = [])).push(
        (
          { request }: { request?: string },
          cb: (err: Error | null, result?: string) => void
        ) => {
          if (request === 'better-sqlite3') {
            return cb(null, 'commonjs better-sqlite3');
          }
          return cb(null);
        }
      );
    }
    return config;
  };
  return out;
})();

export default config;
