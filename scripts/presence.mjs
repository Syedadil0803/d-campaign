/**
 * Who is holding unsaved work, and where.
 *
 *   npm run presence          list every device claim
 *   npm run presence -- clear lower every flag (does not touch the work itself)
 *
 * The flag is all the server knows: the card stays in the browser that made
 * it, so nothing here can show you the work — only that it exists.
 */
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set. Add it to .env.local first.');
  process.exit(1);
}

const sql = postgres(connectionString, { prepare: false });
const clearing = process.argv[2] === 'clear';

try {
  if (clearing) {
    // Deleted, not set false: a row exists precisely because a device is
    // holding unsaved work, so clearing the claim means removing the row.
    const r = await sql`DELETE FROM campaign.user_device_presence`;
    console.log(`Cleared ${r.count} claim(s). The work itself is untouched.`);
  }

  const rows = await sql`
    SELECT u.email,
           p.device_label,
           left(p.device_id, 8) || '…' AS device,
           p.has_unsaved_local_changes  AS unsaved,
           to_char(p.last_unsaved_at, 'Mon DD HH24:MI') AS "last seen",
           (now() - p.last_unsaved_at > interval '14 days') AS stale
      FROM campaign.user_device_presence p
      JOIN campaign.users u ON u.id = p.user_id
     ORDER BY p.last_unsaved_at DESC
  `;

  if (!rows.length) {
    console.log('No device claims at all.');
  } else {
    console.table(rows.map((r) => ({ ...r })));
    const live = rows.filter((r) => !r.stale).length;
    console.log(
      `${live} device(s) holding unsaved work` +
        ` (claims older than 14 days are ignored by the app).`,
    );
  }
} catch (error) {
  console.error('Query failed:', error.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
