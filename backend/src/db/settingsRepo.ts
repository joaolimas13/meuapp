import type { GeneralSettings } from '../../../shared/types'
import type { DB } from '.'
import { BadRequest } from '../lib/validate'
import { isDate } from '../lib/time'

export const DEFAULT_GENERAL: GeneralSettings = {
  quietStart: '23:00',
  quietEnd: '06:00',
  dnd: false,
  shift: { enabled: false, anchorDate: null, workDays: 1, offDays: 3 }, // 24h de trabalho / 72h de folga
  content: { days: [1, 3, 5], remindAt: '10:00' }, // seg, qua, sex
  study: { weeklyHours: 10 },
  sleep: { enabled: true, windDown: '22:00' },
  weekly: { enabled: true, day: 0, time: '19:00' }, // domingo à noite
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

/** Configurações gerais (silêncio, não perturbe, escala de trabalho) guardadas na tabela `settings`. */
export class SettingsRepo {
  constructor(private db: DB) {}

  general(): GeneralSettings {
    const r = this.db.prepare("SELECT value FROM settings WHERE key = 'general'").get() as { value: string } | undefined
    const saved = r ? (JSON.parse(r.value) as Partial<GeneralSettings>) : {}
    return { ...DEFAULT_GENERAL, ...saved, shift: { ...DEFAULT_GENERAL.shift, ...(saved.shift ?? {}) }, content: { ...DEFAULT_GENERAL.content, ...(saved.content ?? {}) }, study: { ...DEFAULT_GENERAL.study, ...(saved.study ?? {}) }, sleep: { ...DEFAULT_GENERAL.sleep, ...(saved.sleep ?? {}) }, weekly: { ...DEFAULT_GENERAL.weekly, ...(saved.weekly ?? {}) } }
  }

  saveGeneral(patch: Partial<GeneralSettings> & { shift?: Partial<GeneralSettings['shift']>; content?: Partial<GeneralSettings['content']>; study?: Partial<GeneralSettings['study']>; sleep?: Partial<GeneralSettings['sleep']>; weekly?: Partial<GeneralSettings['weekly']> }): GeneralSettings {
    const cur = this.general()
    const next: GeneralSettings = { ...cur, ...patch, shift: { ...cur.shift, ...(patch.shift ?? {}) }, content: { ...cur.content, ...(patch.content ?? {}) }, study: { ...cur.study, ...(patch.study ?? {}) }, sleep: { ...cur.sleep, ...(patch.sleep ?? {}) }, weekly: { ...cur.weekly, ...(patch.weekly ?? {}) } }
    if (!HHMM.test(next.quietStart) || !HHMM.test(next.quietEnd)) throw new BadRequest('Horários de silêncio devem ser HH:MM.')
    if (typeof next.dnd !== 'boolean') throw new BadRequest('"dnd" deve ser verdadeiro ou falso.')
    const c = next.content
    if (!Array.isArray(c.days) || c.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6) || !HHMM.test(c.remindAt)) {
      throw new BadRequest('Dias de postagem (0 a 6) ou horário inválidos.')
    }
    next.content = { days: [...new Set(c.days)].sort(), remindAt: c.remindAt }
    if (typeof next.study.weeklyHours !== 'number' || next.study.weeklyHours < 0 || next.study.weeklyHours > 100) throw new BadRequest('Meta de estudo inválida (0 a 100 h).')
    if (typeof next.sleep.enabled !== 'boolean' || !HHMM.test(next.sleep.windDown)) throw new BadRequest('Horário de desacelerar inválido.')
    const w = next.weekly
    if (typeof w.enabled !== 'boolean' || !Number.isInteger(w.day) || w.day < 0 || w.day > 6 || !HHMM.test(w.time)) throw new BadRequest('Revisão semanal inválida.')
    const sh = next.shift
    if (sh.anchorDate !== null && !isDate(sh.anchorDate)) throw new BadRequest('Data da escala inválida.')
    if (!Number.isInteger(sh.workDays) || !Number.isInteger(sh.offDays) || sh.workDays < 1 || sh.offDays < 0 || sh.workDays + sh.offDays > 30) {
      throw new BadRequest('Escala inválida: informe dias de trabalho (≥1) e de folga.')
    }
    if (sh.enabled && !sh.anchorDate) throw new BadRequest('Informe um dia de trabalho para calcular a escala.')
    this.db
      .prepare("INSERT INTO settings (key, value) VALUES ('general', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .run(JSON.stringify(next))
    return next
  }
}
