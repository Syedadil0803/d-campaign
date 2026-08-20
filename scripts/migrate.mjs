/**
 * Applies a migration file.
 *
 *   node scripts/migrate.mjs migrations/002_auth_and_presence.sql
 *
 * Deliberately dumb: no migration table, no ordering, no rollback. The
 * migrations here are written to be safe to run twice (IF NOT EXISTS, and
 * updates that match nothing the second time), so "run it again" is the
 * recovery story rather than state this script would have to track.
 */
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import { readFile } from 'node:fs/promises';

dotenv.config({ path: '.env.local' });

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/migrate.mjs <path-to.sql>');
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set. Add it to .env.local first.');
  process.exit(1);
}

const sqlText = await readFile(file, 'utf8');
const sql = postgres(connectionString, { prepare: false });

try {
  // One transaction: a migration that half-applied would be worse than one
  // that did not apply at all.
  await sql.begin((tx) => [tx.unsafe(sqlText)]);
  console.log(`Applied ${file}`);
} catch (error) {
  console.error(`Failed to apply ${file}:`, error.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
