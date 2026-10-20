/** Utilitários de data/hora no fuso configurado (o GAIA pensa em horário local, não UTC). */

export interface LocalNow {
  /** AAAA-MM-DD */
  date: string
  /** HH:MM (24h) */
  time: string
}

/** Data e hora de agora no fuso `tz`. */
export function localNow(tz: string, now: Date = new Date()): LocalNow {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)!.value
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` }
}

/** Soma `days` dias a uma data AAAA-MM-DD (aritmética de calendário, sem fuso). */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export const isDate = (s: unknown): s is string =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T12:00:00Z`))

/** "AAAA-MM-DD" ou "AAAA-MM-DDTHH:MM". */
export const isDue = (s: unknown): s is string =>
  typeof s === 'string' &&
  /^\d{4}-\d{2}-\d{2}(T([01]\d|2[0-3]):[0-5]\d)?$/.test(s) &&
  isDate(s.slice(0, 10))

export const dueDate = (due: string) => due.slice(0, 10)
export const dueTime = (due: string) => (due.length > 10 ? due.slice(11, 16) : null)

/** Remove acentos e põe em minúsculas, para buscas que ignoram "ç", "é" etc. */
export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** "AAAA-MM-DD" + "HH:MM" -> minutos desde 1970 (tratando como relógio de parede, sem fuso). */
const wall = (dt: string) => Date.parse(`${dt.slice(0, 10)}T${dt.length > 10 ? dt.slice(11, 16) : '00:00'}:00Z`) / 60_000

/** Minutos de `a` até `b` (positivo se `b` é depois). Aceita "AAAA-MM-DD[THH:MM]". */
export const minutesBetween = (a: string, b: string) => Math.round(wall(b) - wall(a))

/** Soma minutos a um "AAAA-MM-DDTHH:MM". */
export function addMinutes(dt: string, min: number): string {
  return new Date((wall(dt) + min) * 60_000).toISOString().slice(0, 16)
}

/** Agora local como "AAAA-MM-DDTHH:MM". */
export const nowDt = (n: LocalNow) => `${n.date}T${n.time}`

/** True se `time` (HH:MM) está na janela [start, end), que pode cruzar a meia-noite (23:00–06:00). */
export function inWindow(time: string, start: string, end: string): boolean {
  if (start === end) return false
  return start < end ? time >= start && time < end : time >= start || time < end
}
