import { campaignRepository } from '@/repositories/campaignRepository';
import { syncToR2 } from '@/lib/publishToR2';
import { toLocalISODate } from '@/lib/utils';

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

  for (const { id, config } of await campaignRepository.listScheduled()) {
    const startDate = config.promoCard?.startDate;
    if (!startDate || startDate > today) continue; // not its day yet

    const userId = id.slice('scheduled:'.length);

    // The DB row the tool reads, then the file the website reads. R2 last: a
    // failure there leaves the row promoted but the site unchanged, which the
    // next sweep cannot fix — so it is reported rather than swallowed.
    const saved = await campaignRepository.saveConfig(config);
    if (!saved) {
      failed.push(id);
      continue;
    }

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
