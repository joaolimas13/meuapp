import type { DailyLog, Targets, Weights } from '../../../shared/types'
import { DEFAULT_TARGETS, DEFAULT_WEIGHTS } from '../dev/score'
import type { DB } from './index'

interface LogRow {
  date: string
  exercised: number
  exercise_note: string
  studied: number
  study_hours: number | null
  pages: number
  sleep_hours: number | null
  water_l: number
}

const toLog = (r: LogRow): DailyLog => ({
  date: r.date,
  exercised: r.exercised === 1,
  exerciseNote: r.exercise_note,
  studied: r.studied === 1,
  studyHours: r.study_hours,
  pages: r.pages,
  sleepHours: r.sleep_hours,
  waterL: r.water_l,
})

export const emptyLog = (date: string): DailyLog => ({
  date,
  exercised: false,
  exerciseNote: '',
  studied: false,
  studyHours: null,
  pages: 0,
  sleepHours: null,
  waterL: 0,
})

export interface Goal {
  id: number
  title: string
  kind: 'fixed' | 'daily'
  date: string | null
  createdOn: string
  endedOn: string | null
}

interface GoalRow {
  id: number
  title: string
  kind: 'fixed' | 'daily'
  date: string | null
  created_on: string
  ended_on: string | null
}

const toGoal = (r: GoalRow): Goal => ({
  id: r.id,
  title: r.title,
  kind: r.kind,
  date: r.date,
  createdOn: r.created_on,
  endedOn: r.ended_on,
})

const NOW = `strftime('%Y-%m-%dT%H:%M:%fZ','now')`

/** Registro diário, metas e configurações do módulo de desenvolvimento pessoal. */
export class DevRepo {
  constructor(private readonly db: DB) {}

  // ---- registro do dia
  getLog(date: string): DailyLog {
    const row = this.db.prepare('SELECT * FROM daily_log WHERE date = ?').get(date) as LogRow | undefined
    return row ? toLog(row) : emptyLog(date)
  }

  /** Atualiza só os campos informados (os outros ficam como estão). */
  saveLog(date: string, patch: Partial<Omit<DailyLog, 'date'>>): DailyLog {
    const cur = this.getLog(date)
    const next = { ...cur, ...patch }
    this.db
      .prepare(
        `INSERT INTO daily_log (date, exercised, exercise_note, studied, study_hours, pages, sleep_hours, water_l, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ${NOW})
         ON CONFLICT(date) DO UPDATE SET exercised=excluded.exercised, exercise_note=excluded.exercise_note,
           studied=excluded.studied, study_hours=excluded.study_hours, pages=excluded.pages,
           sleep_hours=excluded.sleep_hours, water_l=excluded.water_l, updated_at=${NOW}`,
      )
      .run(
        date,
        next.exercised ? 1 : 0,
        next.exerciseNote,
        next.studied ? 1 : 0,
        next.studyHours,
        next.pages,
        next.sleepHours,
        next.waterL,
      )
    return this.getLog(date)
  }

  logsBetween(from: string, to: string): DailyLog[] {
    return (
      this.db.prepare('SELECT * FROM daily_log WHERE date BETWEEN ? AND ? ORDER BY date').all(from, to) as LogRow[]
    ).map(toLog)
  }

  firstLogDate(): string | null {
    const r = this.db.prepare('SELECT MIN(date) AS d FROM daily_log').get() as { d: string | null }
    return r.d
  }

  /** Total de páginas lidas em todo o período (ou entre duas datas). */
  pages(from?: string, to?: string): number {
    const r = (
      from && to
        ? this.db.prepare('SELECT COALESCE(SUM(pages),0) AS n FROM daily_log WHERE date BETWEEN ? AND ?').get(from, to)
        : this.db.prepare('SELECT COALESCE(SUM(pages),0) AS n FROM daily_log').get()
    ) as { n: number }
    return r.n
  }

  // ---- metas
  addGoal(input: { title: string; kind: 'fixed' | 'daily'; date?: string | null; createdOn: string }): Goal {
    const info = this.db
      .prepare('INSERT INTO goals (title, kind, date, created_on) VALUES (?, ?, ?, ?)')
      .run(input.title, input.kind, input.kind === 'daily' ? input.date ?? input.createdOn : null, input.createdOn)
    return this.getGoal(Number(info.lastInsertRowid))!
  }

  getGoal(id: number): Goal | null {
    const r = this.db.prepare('SELECT * FROM goals WHERE id = ?').get(id) as GoalRow | undefined
    return r ? toGoal(r) : null
  }

  /** Metas que valem em `date`: as fixas (já criadas e não encerradas) e as diárias daquele dia. */
  goalsFor(date: string): (Goal & { done: boolean })[] {
    const rows = this.db
      .prepare(
        `SELECT g.*, EXISTS(SELECT 1 FROM goal_checks c WHERE c.goal_id = g.id AND c.date = ?) AS done
         FROM goals g
         WHERE (g.kind = 'daily' AND g.date = ?)
            OR (g.kind = 'fixed' AND g.created_on <= ? AND (g.ended_on IS NULL OR ? < g.ended_on))
         ORDER BY g.kind, g.id`,
      )
      .all(date, date, date, date) as (GoalRow & { done: number })[]
    return rows.map((r) => ({ ...toGoal(r), done: r.done === 1 }))
  }

  /**
   * Remove uma meta. Fixas são só encerradas (o histórico dos dias passados
   * continua igual); diárias são apagadas.
   */
  removeGoal(id: number, today: string): boolean {
    const g = this.getGoal(id)
    if (!g) return false
    if (g.kind === 'fixed') this.db.prepare('UPDATE goals SET ended_on = ? WHERE id = ?').run(today, id)
    else this.db.prepare('DELETE FROM goals WHERE id = ?').run(id)
    return true
  }

  setCheck(goalId: number, date: string, done: boolean): void {
    if (done) this.db.prepare('INSERT OR IGNORE INTO goal_checks (goal_id, date) VALUES (?, ?)').run(goalId, date)
    else this.db.prepare('DELETE FROM goal_checks WHERE goal_id = ? AND date = ?').run(goalId, date)
  }

  /** Datas que têm alguma atividade (registro ou meta marcada), para calcular o histórico. */
  activeDates(): string[] {
    return (
      this.db
        .prepare('SELECT date FROM daily_log UNION SELECT date FROM goal_checks UNION SELECT date FROM goals WHERE date IS NOT NULL ORDER BY date')
        .all() as { date: string }[]
    ).map((r) => r.date)
  }

  // ---- configurações (metas numéricas e pesos)
  private getSetting<T>(key: string, fallback: T): T {
    const r = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
    return r ? { ...fallback, ...(JSON.parse(r.value) as object) } : fallback
  }
  private setSetting(key: string, value: object) {
    this.db
      .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, JSON.stringify(value))
  }

  targets(): Targets {
    return this.getSetting('dev.targets', DEFAULT_TARGETS)
  }
  saveTargets(patch: Partial<Targets>): Targets {
    const next = { ...this.targets(), ...patch }
    this.setSetting('dev.targets', next)
    return next
  }
  weights(): Weights {
    return this.getSetting('dev.weights', DEFAULT_WEIGHTS)
  }
  saveWeights(patch: Partial<Weights>): Weights {
    const next = { ...this.weights(), ...patch }
    this.setSetting('dev.weights', next)
    return next
  }
}
