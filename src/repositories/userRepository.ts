import { getDb } from '@/lib/db';
import { users, userDevicePresence } from '@/lib/schema';
import { and, desc, eq, gt, ne, sql } from 'drizzle-orm';

export interface UserRow {
  id: string;
  email: string;
  name: string;
  provider: string;
  passwordHash: string | null;
}

/** How long a device's claim is believed before it is treated as abandoned. */
const STALE_AFTER_MS = 14 * 24 * 60 * 60 * 1000;

/** Unsaved work sitting in a browser that is not the one asking. */
export interface ElsewhereUnsaved {
  deviceId: string;
  deviceLabel: string;
  at: string;
}

export const userRepository = {
  async findByEmail(email: string): Promise<UserRow | null> {
    // Stored lowercase, so a capitalised address still signs in.
    const rows = await getDb()
      .select()
      .from(users)
      .where(eq(users.email, email.trim().toLowerCase()))
      .limit(1);
    return rows[0] ?? null;
  },

  async findById(id: string): Promise<UserRow | null> {
    const rows = await getDb().select().from(users).where(eq(users.id, id)).limit(1);
    return rows[0] ?? null;
  },

  /**
   * The most recent OTHER device holding unsaved work, or null.
   *
   * Excluding the caller is what makes this answerable: this browser already
   * knows what it is holding, and its own flag is still up while it holds it.
   * Newest first, because with several stale devices the useful one to name is
   * the machine they were last sitting at.
   */
  async findUnsavedElsewhere(userId: string, deviceId: string): Promise<ElsewhereUnsaved | null> {
    /**
     * Old claims are ignored rather than trusted forever.
     *
     * A device id lives in localStorage, so clearing browser data does not
     * retract the claim — it abandons it, and a new id takes its place. The
     * orphaned row keeps insisting that work is waiting on a browser that no
     * longer has it, and the notice becomes permanent furniture nobody can
     * clear. A fortnight is well past the point where anyone is going back for
     * unsaved edits, and the row costs nothing left in place.
     */
    const cutoff = new Date(Date.now() - STALE_AFTER_MS);

    const rows = await getDb()
      .select()
      .from(userDevicePresence)
      .where(
        and(
          eq(userDevicePresence.userId, userId),
          eq(userDevicePresence.hasUnsavedLocalChanges, true),
          ne(userDevicePresence.deviceId, deviceId),
          gt(userDevicePresence.lastUnsavedAt, cutoff),
        ),
      )
      .orderBy(desc(userDevicePresence.lastUnsavedAt))
      .limit(1);

    const row = rows[0];
    if (!row) return null;
    return {
      deviceId: row.deviceId,
      deviceLabel: row.deviceLabel,
      at: row.lastUnsavedAt.toISOString(),
    };
  },

  /**
   * Drop a device's claim on the account's behalf.
   *
   * Normally only the browser holding unsaved work lowers its own flag, by
   * saving or by discarding. But that browser may be gone — data cleared, a
   * borrowed laptop, a machine reinstalled — and then the claim outlives the
   * work and the notice repeats on every visit with nothing the user can do
   * about it. This is that escape: the row belongs to their account, and they
   * are allowed to say it no longer matters.
   */
  async forgetDevice(userId: string, deviceId: string): Promise<boolean> {
    try {
      await getDb()
        .delete(userDevicePresence)
        .where(
          and(eq(userDevicePresence.userId, userId), eq(userDevicePresence.deviceId, deviceId)),
        );
      return true;
    } catch (error) {
      console.error('[DB] forgetDevice failed:', error);
      return false;
    }
  },

  /**
   * Record a device's claim, or drop it.
   *
   * Only devices actually holding unsaved work have a row. Retracting used to
   * write `false` into the row and keep it, which stored nothing anybody
   * reads — every query filters on the flag being true, and the upsert would
   * recreate the row the moment it mattered again. All it produced was a
   * lengthening trail of dead rows per account.
   *
   * Deleting instead makes the table say exactly one thing: these devices are
   * holding work that was never saved. An empty table means nobody is.
   */
  async setDevicePresence(
    userId: string,
    presence: { hasUnsaved: boolean; deviceId: string; deviceLabel: string },
  ): Promise<boolean> {
    try {
      if (!presence.hasUnsaved) {
        await getDb()
          .delete(userDevicePresence)
          .where(
            and(
              eq(userDevicePresence.userId, userId),
              eq(userDevicePresence.deviceId, presence.deviceId),
            ),
          );
        return true;
      }

      const values = {
        deviceLabel: presence.deviceLabel,
        hasUnsavedLocalChanges: true,
        lastUnsavedAt: new Date(),
      };
      await getDb()
        .insert(userDevicePresence)
        .values({ userId, deviceId: presence.deviceId, ...values })
        .onConflictDoUpdate({
          target: [userDevicePresence.userId, userDevicePresence.deviceId],
          set: values,
        });

      /**
       * A backstop on rows nobody will ever retract.
       *
       * A device id lives in localStorage, so clearing site data abandons a
       * claim rather than lowering it — the old row stays, insisting work
       * waits on a machine that is really this one under a previous identity.
       * Six is past any real device count; the tidy-up is swallowed on failure
       * because it must not fail the write that mattered.
       */
      await getDb()
        .execute(
          sql`DELETE FROM campaign.user_device_presence
               WHERE user_id = ${userId}
                 AND device_id NOT IN (
                   SELECT device_id FROM campaign.user_device_presence
                    WHERE user_id = ${userId}
                    ORDER BY last_unsaved_at DESC
                    LIMIT 6
                 )`,
        )
        .catch(() => {});

      return true;
    } catch (error) {
      console.error('[DB] setDevicePresence failed:', error);
      return false;
    }
  },
};
