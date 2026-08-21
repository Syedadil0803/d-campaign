import { getDb } from '@/lib/db';
import { users, userDevicePresence } from '@/lib/schema';
import { and, desc, eq, ne } from 'drizzle-orm';

export interface UserRow {
  id: string;
  email: string;
  name: string;
  provider: string;
  passwordHash: string | null;
}

/** Unsaved work sitting in a browser that is not the one asking. */
export interface ElsewhereUnsaved {
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
    const rows = await getDb()
      .select()
      .from(userDevicePresence)
      .where(
        and(
          eq(userDevicePresence.userId, userId),
          eq(userDevicePresence.hasUnsavedLocalChanges, true),
          ne(userDevicePresence.deviceId, deviceId),
        ),
      )
      .orderBy(desc(userDevicePresence.lastUnsavedAt))
      .limit(1);

    const row = rows[0];
    if (!row) return null;
    return { deviceLabel: row.deviceLabel, at: row.lastUnsavedAt.toISOString() };
  },

  /**
   * Record — or retract — this device's claim.
   *
   * Only ever touches the calling device's own row, so one browser saving its
   * work can no longer clear another's claim.
   */
  async setDevicePresence(
    userId: string,
    presence: { hasUnsaved: boolean; deviceId: string; deviceLabel: string },
  ): Promise<boolean> {
    try {
      const values = {
        deviceLabel: presence.deviceLabel,
        hasUnsavedLocalChanges: presence.hasUnsaved,
        lastUnsavedAt: new Date(),
      };
      await getDb()
        .insert(userDevicePresence)
        .values({ userId, deviceId: presence.deviceId, ...values })
        .onConflictDoUpdate({
          target: [userDevicePresence.userId, userDevicePresence.deviceId],
          set: values,
        });
      return true;
    } catch (error) {
      console.error('[DB] setDevicePresence failed:', error);
      return false;
    }
  },
};
