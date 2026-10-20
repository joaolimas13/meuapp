import type { Checkin, StudyCard, TrainingEntry, VaultItem, VaultStatus } from '../../../shared/types'
import type { DB } from '.'

interface CardRow { id: number; topic: string; question: string; answer: string; box: number; next_review: string }
const toCard = (r: CardRow): StudyCard => ({ id: r.id, topic: r.topic, question: r.question, answer: r.answer, box: r.box, nextReview: r.next_review })

/** Check-ins, cartões de estudo, plano de treino, cofre de ideias e controle de tarefas geradas. */
export class WellbeingRepo {
  constructor(private db: DB) {}

  // ---- check-ins
  addCheckin(c: { date: string; time: string; energy: number; mood: number; note: string }): Checkin {
    const id = this.db.prepare('INSERT INTO checkins (date, time, energy, mood, note) VALUES (?,?,?,?,?)').run(c.date, c.time, c.energy, c.mood, c.note).lastInsertRowid as number
    return { id, ...c }
  }
  checkinsBetween(from: string, to: string): Checkin[] {
    return this.db.prepare('SELECT id, date, time, energy, mood, note FROM checkins WHERE date BETWEEN ? AND ? ORDER BY date, time, id').all(from, to) as Checkin[]
  }
  lastCheckin(): Checkin | null {
    return (this.db.prepare('SELECT id, date, time, energy, mood, note FROM checkins ORDER BY date DESC, time DESC, id DESC LIMIT 1').get() as Checkin | undefined) ?? null
  }

  // ---- estudos
  addCard(c: { topic: string; question: string; answer: string }, today: string): StudyCard {
    const id = this.db.prepare('INSERT INTO study_cards (topic, question, answer, next_review) VALUES (?,?,?,?)').run(c.topic, c.question, c.answer, today).lastInsertRowid as number
    return this.getCard(id)!
  }
  getCard(id: number): StudyCard | null {
    const r = this.db.prepare('SELECT * FROM study_cards WHERE id = ?').get(id) as CardRow | undefined
    return r ? toCard(r) : null
  }
  dueCards(today: string, limit = 10): StudyCard[] {
    return (this.db.prepare('SELECT * FROM study_cards WHERE next_review <= ? ORDER BY next_review, id LIMIT ?').all(today, limit) as CardRow[]).map(toCard)
  }
  dueCount(today: string): number {
    return (this.db.prepare('SELECT COUNT(*) AS n FROM study_cards WHERE next_review <= ?').get(today) as { n: number }).n
  }
  cardTopics(): { topic: string; cards: number }[] {
    return this.db.prepare("SELECT topic, COUNT(*) AS cards FROM study_cards GROUP BY topic ORDER BY cards DESC").all() as { topic: string; cards: number }[]
  }
  totalCards(): number {
    return (this.db.prepare('SELECT COUNT(*) AS n FROM study_cards').get() as { n: number }).n
  }
  setCardSchedule(id: number, box: number, nextReview: string) {
    this.db.prepare('UPDATE study_cards SET box = ?, next_review = ? WHERE id = ?').run(box, nextReview, id)
  }
  deleteCard(id: number): boolean {
    return this.db.prepare('DELETE FROM study_cards WHERE id = ?').run(id).changes > 0
  }

  // ---- treino
  training(): (TrainingEntry & { id: number })[] {
    return this.db.prepare('SELECT id, weekday, title, time FROM training_plan ORDER BY weekday, time, id').all() as (TrainingEntry & { id: number })[]
  }
  replaceTraining(list: TrainingEntry[]) {
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM training_plan').run()
      const ins = this.db.prepare('INSERT INTO training_plan (weekday, title, time) VALUES (?,?,?)')
      for (const e of list) ins.run(e.weekday, e.title, e.time)
    })()
  }

  // ---- cofre
  vault(): VaultItem[] {
    return (this.db.prepare("SELECT id, title, notes, kind, status, created_at AS createdAt FROM vault_items WHERE status != 'descartada' ORDER BY id DESC").all() as VaultItem[])
  }
  getVault(id: number): VaultItem | null {
    return (this.db.prepare('SELECT id, title, notes, kind, status, created_at AS createdAt FROM vault_items WHERE id = ?').get(id) as VaultItem | undefined) ?? null
  }
  addVault(v: { title: string; notes: string; kind: 'ideia' | 'projeto' }): VaultItem {
    const id = this.db.prepare('INSERT INTO vault_items (title, notes, kind) VALUES (?,?,?)').run(v.title, v.notes, v.kind).lastInsertRowid as number
    return this.getVault(id)!
  }
  setVaultStatus(id: number, status: VaultStatus) {
    this.db.prepare('UPDATE vault_items SET status = ? WHERE id = ?').run(status, id)
  }
  openVaultCount(): number {
    return (this.db.prepare("SELECT COUNT(*) AS n FROM vault_items WHERE status IN ('guardada','adiada')").get() as { n: number }).n
  }

  // ---- tarefas geradas (1 vez por chave/dia)
  /** Marca a chave como gerada; devolve true se era a primeira vez. */
  claim(key: string, date: string): boolean {
    return this.db.prepare('INSERT OR IGNORE INTO generated_tasks (key, date) VALUES (?, ?)').run(key, date).changes > 0
  }

  // ---- rotinas: dias com algum checklist de âncora 100% concluído
  routineDays(from: string, to: string): string[] {
    const rows = this.db
      .prepare(
        `SELECT c.date AS date, i.anchor_id AS anchor, COUNT(*) AS done
           FROM anchor_checks c JOIN anchor_items i ON i.id = c.item_id
          WHERE c.date BETWEEN ? AND ? GROUP BY c.date, i.anchor_id`,
      )
      .all(from, to) as { date: string; anchor: number; done: number }[]
    const totals = new Map((this.db.prepare('SELECT anchor_id, COUNT(*) AS n FROM anchor_items GROUP BY anchor_id').all() as { anchor_id: number; n: number }[]).map((r) => [r.anchor_id, r.n]))
    return [...new Set(rows.filter((r) => r.done >= (totals.get(r.anchor) ?? Infinity)).map((r) => r.date))].sort()
  }

  /** Instantes (ISO) em que posts foram marcados como postados; o chamador converte para o dia local. */
  postedAtList(): string[] {
    return (this.db.prepare('SELECT posted_at FROM content_posts WHERE posted_at IS NOT NULL ORDER BY posted_at DESC LIMIT 200').all() as { posted_at: string }[]).map((r) => r.posted_at)
  }
}
