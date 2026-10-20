import type { Bridge, FocusSession } from '../../../shared/types'
import type { DB } from '.'

interface FocusRow { id: number; task_id: number | null; title: string; minutes: number; break_minutes: number; started_at: string; ended_at: string | null; outcome: string | null }
interface BridgeRow { id: number; task_id: number | null; title: string; note: string; next_step: string; created_at: string }

const toFocus = (r: FocusRow): FocusSession => ({
  id: r.id, taskId: r.task_id, title: r.title, minutes: r.minutes, breakMinutes: r.break_minutes,
  startedAt: r.started_at, endedAt: r.ended_at, outcome: r.outcome,
})
const toBridge = (r: BridgeRow): Bridge => ({
  id: r.id, taskId: r.task_id, title: r.title, note: r.note, nextStep: r.next_step, createdAt: r.created_at,
})

export const FOCUS_OUTCOMES = ['done', 'continue', 'switch', 'interrupted'] as const
export type FocusOutcome = (typeof FOCUS_OUTCOMES)[number]

/** Sessões de foco, "pontes" (onde parei) e soneca de lembretes. */
export class FocusRepo {
  constructor(private db: DB) {}

  // ---- foco
  current(): FocusSession | null {
    const r = this.db.prepare('SELECT * FROM focus_sessions WHERE ended_at IS NULL ORDER BY id DESC LIMIT 1').get() as FocusRow | undefined
    return r ? toFocus(r) : null
  }
  getSession(id: number): FocusSession | null {
    const r = this.db.prepare('SELECT * FROM focus_sessions WHERE id = ?').get(id) as FocusRow | undefined
    return r ? toFocus(r) : null
  }
  start(input: { taskId: number | null; title: string; minutes: number; breakMinutes: number }, nowIso: string): FocusSession {
    const id = this.db
      .prepare('INSERT INTO focus_sessions (task_id, title, minutes, break_minutes, started_at) VALUES (?,?,?,?,?)')
      .run(input.taskId, input.title, input.minutes, input.breakMinutes, nowIso).lastInsertRowid as number
    return this.getSession(id)!
  }
  finish(id: number, outcome: FocusOutcome, nowIso: string) {
    this.db.prepare('UPDATE focus_sessions SET ended_at = ?, outcome = ? WHERE id = ? AND ended_at IS NULL').run(nowIso, outcome, id)
  }

  // ---- pontes
  addBridge(b: { taskId: number | null; title: string; note: string; nextStep: string }): Bridge {
    const id = this.db
      .prepare('INSERT INTO bridges (task_id, title, note, next_step) VALUES (?,?,?,?)')
      .run(b.taskId, b.title, b.note, b.nextStep).lastInsertRowid as number
    return toBridge(this.db.prepare('SELECT * FROM bridges WHERE id = ?').get(id) as BridgeRow)
  }
  /** A ponte mais recente ainda não retomada. */
  lastBridge(): Bridge | null {
    const r = this.db.prepare('SELECT * FROM bridges WHERE resolved = 0 ORDER BY id DESC LIMIT 1').get() as BridgeRow | undefined
    return r ? toBridge(r) : null
  }
  resolveBridge(id: number): boolean {
    return this.db.prepare('UPDATE bridges SET resolved = 1 WHERE id = ?').run(id).changes > 0
  }

  // ---- soneca
  snooze(taskId: number, until: string) {
    this.db
      .prepare('INSERT INTO reminder_state (task_id, snoozed_until) VALUES (?, ?) ON CONFLICT(task_id) DO UPDATE SET snoozed_until = excluded.snoozed_until')
      .run(taskId, until)
  }
  snoozes(): Map<number, string> {
    const rows = this.db.prepare('SELECT task_id, snoozed_until FROM reminder_state WHERE snoozed_until IS NOT NULL').all() as { task_id: number; snoozed_until: string }[]
    return new Map(rows.map((r) => [r.task_id, r.snoozed_until]))
  }
}
