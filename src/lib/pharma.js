// Janelas farmacológicas da lisdexanfetamina 50mg, baseadas no perfil descrito pelo usuário.
const ONSET_MIN_MS = 90 * 60 * 1000; // +1h30
const PEAK_START_MS = 3 * 60 * 60 * 1000; // +3h
const PEAK_END_MS = 4 * 60 * 60 * 1000; // +4h
const DECLINE_START_MS = 6 * 60 * 60 * 1000; // +6h

export function getMedicationWindows(takenAt) {
  const t = new Date(takenAt).getTime();
  return {
    takenAt: t,
    onsetStart: t + ONSET_MIN_MS,
    peakStart: t + PEAK_START_MS,
    peakEnd: t + PEAK_END_MS,
    declineStart: t + DECLINE_START_MS,
  };
}

export function getMedicationPhase(takenAt, now = Date.now()) {
  if (!takenAt) return 'none';
  const w = getMedicationWindows(takenAt);
  if (now < w.takenAt) return 'none';
  if (now < w.onsetStart) return 'aguardando_efeito';
  if (now < w.peakStart) return 'subindo';
  if (now < w.peakEnd) return 'pico';
  if (now < w.declineStart) return 'platô';
  return 'declínio';
}

const PHASE_LABELS = {
  none: 'Sem registro de tomada hoje',
  aguardando_efeito: 'Aguardando início de efeito',
  subindo: 'Efeito subindo',
  pico: 'Pico de efeito',
  'platô': 'Platô',
  'declínio': 'Em declínio',
};

export function getPhaseLabel(phase) {
  return PHASE_LABELS[phase] || phase;
}

// Janela de ouro: bloco de pico cognitivo, fixo das 11h às 13h independente do horário de tomada,
// conforme rotina validada pelo usuário (tomada às 9h -> pico 11h-13h).
export function getGoldenWindow(date = new Date()) {
  const start = new Date(date);
  start.setHours(11, 0, 0, 0);
  const end = new Date(date);
  end.setHours(13, 0, 0, 0);
  return { start: start.getTime(), end: end.getTime() };
}

export function isGoldenWindowActive(now = Date.now(), date = new Date()) {
  const { start, end } = getGoldenWindow(date);
  return now >= start && now <= end;
}

export function msToCountdown(ms) {
  if (ms <= 0) return '00:00';
  const totalMinutes = Math.floor(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
