/**
 * Creates (or re-points) the test account.
 *
*   node scripts/seed-user.mjs [email] [password]
 *
 * Takes the password from SEED_PASSWORD in .env.local when no argument is
 * given, so the real value never reaches the repository.
 *
 * Sign-in is meant to move to Google, so this account is a stand-in and
 * nothing else should depend on it existing. Re-running is safe: an account
 * with the same email has its password reset rather than being duplicated,
 * which is what you want when you have forgotten what you seeded it with.
 */
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';

dotenv.config({ path: '.env.local' });

const scrypt = promisify(scryptCallback);

const email = (process.argv[2] || process.env.SEED_EMAIL || 'test@gmail.com')
  .trim()
  .toLowerCase();

// From .env.local, which is gitignored — a password committed here would stay
// in the history after the line was changed. An argument still wins, for
// seeding a one-off account without editing anything.
const password = process.argv[3] || process.env.SEED_PASSWORD;
if (!password) {
  console.error(
    'No password. Set SEED_PASSWORD in .env.local, or pass one:\n' +
    '  npm run seed:user <email> <password>',
  );
  process.exit(1);
}
const name = 'Test User';
// Fixed, because migration 002 hands the pre-accounts draft to this id.
const id = 'test-user';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set. Add it to .env.local first.');
  process.exit(1);
}

const salt = randomBytes(16);
const derived = await scrypt(password, salt, 64);
const passwordHash = `${salt.toString('hex')}:${derived.toString('hex')}`;

const sql = postgres(connectionString, { prepare: false });

try {
  await sql`
    INSERT INTO campaign.users (id, email, name, provider, password_hash)
    VALUES (${id}, ${email}, ${name}, 'password', ${passwordHash})
    ON CONFLICT (email) DO UPDATE
      SET password_hash = EXCLUDED.password_hash,
          provider      = 'password'
  `;
  console.log(`Seeded account ${email}`);
  console.log(`Password: ${password}`);
} catch (error) {
  console.error('Could not seed the account:', error.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
