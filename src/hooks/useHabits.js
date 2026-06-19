import { useLiveQuery } from 'dexie-react-hooks';
import { db, ensureDefaultHabits } from '../db/db';
import { dateKey, daysAgo } from '../lib/dateUtils';

export function useHabitDefs() {
  return useLiveQuery(async () => {
    await ensureDefaultHabits();
    return db.habitDefs.orderBy('order').toArray();
  }, []);
}

export function useTodayHabitLogs() {
  const key = dateKey();
  return useLiveQuery(() => db.habitLogs.where('date').equals(key).toArray(), [key]);
}

export async function toggleHabit(habitKey) {
  const date = dateKey();
  const existing = await db.habitLogs.where({ date, habitKey }).first();
  if (existing) {
    await db.habitLogs.delete(existing.id);
  } else {
    await db.habitLogs.add({ date, habitKey });
  }
}

export function useHabitHistory(days = 70) {
  return useLiveQuery(async () => {
    const since = dateKey(daysAgo(days));
    const logs = await db.habitLogs.where('date').aboveOrEqual(since).toArray();
    const byDate = {};
    for (const log of logs) {
      byDate[log.date] = (byDate[log.date] || 0) + 1;
    }
    return byDate;
  }, [days]);
}

export function useGoldenWindowStreak() {
  return useLiveQuery(async () => {
    const all = await db.dailyCriteria.toArray();
    const metDates = new Set(all.filter((r) => r.janela_ouro).map((r) => r.date));
    let streak = 0;
    let cursor = new Date();
    while (metDates.has(dateKey(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }, []);
}
