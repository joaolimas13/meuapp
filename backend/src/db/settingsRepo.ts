import type { GeneralSettings } from '../../../shared/types'
import type { DB } from '.'
import { BadRequest } from '../lib/validate'
import { isDate } from '../lib/time'

export const DEFAULT_GENERAL: GeneralSettings = {
  quietStart: '23:00',
  quietEnd: '06:00',
  dnd: false,
  shift: { enabled: false, anchorDate: null, workDays: 1, offDays: 3 }, // 24h de trabalho / 72h de folga
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

/** Configurações gerais (silêncio, não perturbe, escala de trabalho) guardadas na tabela `settings`. */
export class SettingsRepo {
  constructor(private db: DB) {}

  general(): GeneralSettings {
    const r = this.db.prepare("SELECT value FROM settings WHERE key = 'general'").get() as { value: string } | undefined
    const saved = r ? (JSON.parse(r.value) as Partial<GeneralSettings>) : {}
    return { ...DEFAULT_GENERAL, ...saved, shift: { ...DEFAULT_GENERAL.shift, ...(saved.shift ?? {}) } }
  }

  saveGeneral(patch: Partial<GeneralSettings> & { shift?: Partial<GeneralSettings['shift']> }): GeneralSettings {
    const cur = this.general()
    const next: GeneralSettings = { ...cur, ...patch, shift: { ...cur.shift, ...(patch.shift ?? {}) } }
    if (!HHMM.test(next.quietStart) || !HHMM.test(next.quietEnd)) throw new BadRequest('Horários de silêncio devem ser HH:MM.')
    if (typeof next.dnd !== 'boolean') throw new BadRequest('"dnd" deve ser verdadeiro ou falso.')
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
