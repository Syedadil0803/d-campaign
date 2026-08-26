import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/lib/db/schema';

// Lazily create the client on first use — NOT at module load. Instantiating it
// at import time would require DATABASE_URL during `next build` (page-data
// collection), which isn't available there and throws "Invalid URL".
function createDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }
  // Disable prefetch as it's not supported for "Transaction" pool mode
  const client = postgres(connectionString, { prepare: false });
  return drizzle(client, { schema });
}

let _db: ReturnType<typeof createDb> | null = null;

export function getDb() {
  if (!_db) _db = createDb();
  return _db;
}
