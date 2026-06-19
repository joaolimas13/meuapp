import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { startOfDay, endOfDay, daysAgo } from '../lib/dateUtils';

export function getPeriod(now = new Date()) {
  return now.getHours() < 14 ? 'manha' : 'tarde';
}

export function useTodayMoodLogs() {
  return useLiveQuery(
    () => db.moodLogs.where('timestamp').between(startOfDay(), endOfDay(), true, true).toArray(),
    []
  );
}

export function useRecentMoodLogs(days = 30) {
  return useLiveQuery(() => {
    const since = startOfDay(daysAgo(days));
    return db.moodLogs.where('timestamp').aboveOrEqual(since).sortBy('timestamp');
  }, [days]);
}

export async function logMood({ mood, anxiety, energy, note = '' }) {
  const now = Date.now();
  return db.moodLogs.add({ timestamp: now, period: getPeriod(new Date(now)), mood, anxiety, energy, note });
}
