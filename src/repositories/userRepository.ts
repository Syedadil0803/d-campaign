import { getDb } from '@/lib/db';
import { users, userPresence } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export interface UserRow {
  id: string;
  email: string;
  name: string;
  provider: string;
  passwordHash: string | null;
}

/** What another device needs to know about work it cannot see. */
export interface Presence {
  hasUnsavedLocalChanges: boolean;
  lastUnsavedDeviceId: string | null;
  lastUnsavedDeviceLabel: string | null;
  lastUnsavedAt: string | null;
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

  async getPresence(userId: string): Promise<Presence> {
    const rows = await getDb()
      .select()
      .from(userPresence)
      .where(eq(userPresence.userId, userId))
      .limit(1);

    const row = rows[0];
    // No row means nothing was ever left unsaved — the same answer as a row
    // saying so, and worth not making every caller handle both shapes.
    if (!row) {
      return {
        hasUnsavedLocalChanges: false,
        lastUnsavedDeviceId: null,
        lastUnsavedDeviceLabel: null,
        lastUnsavedAt: null,
      };
    }
    return {
      hasUnsavedLocalChanges: row.hasUnsavedLocalChanges,
      lastUnsavedDeviceId: row.lastUnsavedDeviceId,
      lastUnsavedDeviceLabel: row.lastUnsavedDeviceLabel,
      lastUnsavedAt: row.lastUnsavedAt ? row.lastUnsavedAt.toISOString() : null,
    };
  },

  /**
   * Record — or retract — the claim that a browser is holding unsaved work.
   *
   * Retracting keeps the device columns rather than nulling them, so "you saved
   * it from the laptop" stays answerable after the flag itself is down.
   */
  async setPresence(
    userId: string,
    presence: { hasUnsaved: boolean; deviceId: string; deviceLabel: string },
  ): Promise<boolean> {
    try {
      const values = {
        hasUnsavedLocalChanges: presence.hasUnsaved,
        lastUnsavedDeviceId: presence.deviceId,
        lastUnsavedDeviceLabel: presence.deviceLabel,
        lastUnsavedAt: new Date(),
      };
      await getDb()
        .insert(userPresence)
        .values({ userId, ...values })
        .onConflictDoUpdate({ target: userPresence.userId, set: values });
      return true;
    } catch (error) {
      console.error('[DB] setPresence failed:', error);
      return false;
    }
  },
};
