/**
 * Process-wide SSL defaults for any 'pg' client, even strays.
 * This must run before any Pool/Client is created.
 * Only applies when using PostgreSQL (not SQLite).
 */
import * as pg from 'pg';

import { computePgSsl } from './pg-ssl';

// Only configure SSL if we're using PostgreSQL
const driver = (process.env.DB_DRIVER || 'sqlite').toLowerCase();
if (driver === 'postgres') {
  const { ssl, mode } = computePgSsl(process.env.DATABASE_URL);
  (pg as { defaults: { ssl?: unknown } }).defaults.ssl = ssl || undefined;

  if (
    process.env.PG_LOG_SSL_MODE === '1' ||
    process.env.NODE_ENV !== 'production'
  ) {
    const brief =
      ssl === false
        ? 'false'
        : `{rejectUnauthorized:${(ssl as { rejectUnauthorized?: boolean })?.rejectUnauthorized === false ? 'false' : 'true'},ca:${(ssl as { ca?: string })?.ca ? 'yes' : 'no'}}`;
    console.info(`[db] pg.defaults.ssl set, mode=${mode} ssl=${brief}`);
  }
}

export {};
