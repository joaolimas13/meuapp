import Dexie from 'dexie';

export const db = new Dexie('meuapp');

db.version(1).stores({
  medicationLogs: '++id, timestamp, effectNote',
  habitLogs: '++id, date, habitKey',
  moodLogs: '++id, timestamp, period, mood, anxiety, energy',
  sleepImports: '++id, date, raw',
  habitDefs: 'key, label, order',
  dailyCriteria: 'date',
});

const DEFAULT_HABITS = [
  { key: 'cafe_completo', label: 'Café da manhã completo', order: 1 },
  { key: 'janela_ouro', label: 'Janela de ouro protegida', order: 2 },
  { key: 'treino', label: 'Treino', order: 3 },
  { key: 'reset_10min', label: 'Reset de 10 min do quarto', order: 4 },
  { key: 'leitura', label: 'Leitura física (20 min)', order: 5 },
  { key: 'pincel_lavado', label: 'Pincéis lavados', order: 6 },
];

export async function ensureDefaultHabits() {
  const count = await db.habitDefs.count();
  if (count === 0) {
    await db.habitDefs.bulkAdd(DEFAULT_HABITS);
  }
}
