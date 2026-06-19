import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { daysAgo, dateKey } from '../lib/dateUtils';

export async function importSleepEntries(entries) {
  for (const entry of entries) {
    await db.sleepImports.put({ date: entry.date, raw: entry });
  }
}

export function useRecentSleep(days = 14) {
  return useLiveQuery(async () => {
    const since = dateKey(daysAgo(days));
    const all = await db.sleepImports.toArray();
    return all.filter((s) => s.date >= since).sort((a, b) => (a.date > b.date ? 1 : -1));
  }, [days]);
}
