// Parser tolerante para JSON exportado do Zepp/Mi Fitness.
// Schema real ainda não confirmado pelo usuário — este parser tenta múltiplos
// nomes de campo plausíveis e nunca lança erro por campo ausente.
// Quando o usuário tiver um export real, ajustar os caminhos abaixo.

function pick(obj, paths) {
  for (const path of paths) {
    const value = path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
    if (value !== undefined && value !== null) return value;
  }
  return null;
}

export function parseSleepEntry(raw) {
  return {
    totalSleepMinutes: pick(raw, ['sleep.totalMinutes', 'totalSleepMinutes', 'sleep_total_min']),
    deepSleepMinutes: pick(raw, ['sleep.deepMinutes', 'deepSleepMinutes', 'sleep_deep_min']),
    nightWakeups: pick(raw, ['sleep.wakeCount', 'nightWakeups', 'sleep_wake_count']),
    restingHeartRate: pick(raw, ['heartRate.resting', 'restingHeartRate', 'hr_resting']),
    exerciseHeartRateAvg: pick(raw, ['heartRate.exerciseAvg', 'exerciseHeartRateAvg', 'hr_exercise_avg']),
    steps: pick(raw, ['activity.steps', 'steps']),
    date: pick(raw, ['date', 'day']),
  };
}

export function parseSleepFile(jsonText) {
  let data;
  try {
    data = JSON.parse(jsonText);
  } catch {
    throw new Error('Arquivo não é um JSON válido.');
  }
  const entries = Array.isArray(data) ? data : [data];
  return entries.map(parseSleepEntry).filter((e) => e.date);
}
