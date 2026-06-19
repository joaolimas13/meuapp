import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { startOfDay, endOfDay, daysAgo } from '../lib/dateUtils';

export function useTodayMedicationLog() {
  return useLiveQuery(async () => {
    const today = await db.medicationLogs
      .where('timestamp')
      .between(startOfDay(), endOfDay(), true, true)
      .last();
    return today ?? null;
  }, []);
}

export function useWeekMedicationLogs() {
  return useLiveQuery(async () => {
    const since = startOfDay(daysAgo(7));
    return db.medicationLogs.where('timestamp').aboveOrEqual(since).reverse().sortBy('timestamp');
  }, []);
}

export async function logMedicationTaken(timestamp = Date.now(), effectNote = '') {
  return db.medicationLogs.add({ timestamp, effectNote });
}

export async function setEffectNote(id, effectNote) {
  return db.medicationLogs.update(id, { effectNote });
}

export async function deleteMedicationLog(id) {
  return db.medicationLogs.delete(id);
}
