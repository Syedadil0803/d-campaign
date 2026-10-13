import { campaignRepository } from '@/repositories/campaignRepository';
import { syncToR2 } from '@/lib/publishToR2';
import { toLocalISODate } from '@/lib/utils';
import { mergeScheduled } from '@/lib/mergeScheduled';

/**
 * Puts scheduled campaigns live once their start date arrives.
 *
 * One sweep handles every account, so the number of scheduled campaigns never
 * becomes a number of cron jobs — the work grows inside the query.
 *
 * Idempotent: the row is deleted once promoted, so a second run finds nothing
 * and a run that overlaps another cannot publish twice.
 *
 * Called both by the promote endpoint (whatever triggers it) and when the tool
 * loads, so it still works with no scheduler wired up.
 */
export async function promoteDueScheduled(): Promise<{ promoted: string[]; failed: string[] }> {
  const today = toLocalISODate(new Date());
  const promoted: string[] = [];
  const failed: string[] = [];

  const rows = await campaignRepository.listScheduled();
  // Read once, only when there is something to sweep, and carried forward so a
  // second promotion in the same sweep merges onto the first.
  let live = rows.length ? await campaignRepository.getConfig() : null;

  for (const { id, config: scheduled } of rows) {
    const config = mergeScheduled(live, scheduled, today);
    if (!config) continue; // not its day yet
    const startDate = scheduled.promoCard.startDate;

    const userId = id.slice('scheduled:'.length);

    // The DB row the tool reads, then the file the website reads. R2 last: a
    // failure there leaves the row promoted but the site unchanged, which the
    // next sweep cannot fix — so it is reported rather than swallowed.
    const saved = await campaignRepository.saveConfig(config);
    if (!saved) {
      failed.push(id);
      continue;
    }
    live = config;

    const synced = await syncToR2(config);
    if (!synced.ok) {
      failed.push(id);
      continue;
    }

    await campaignRepository.deleteScheduled(userId);
    promoted.push(id);
    console.log(`[SCHEDULE] promoted ${id} (start ${startDate})`);
  }

  return { promoted, failed };
}
