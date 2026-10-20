import type { Anchor } from '../../../shared/types'
import type { DB } from '.'

/** Âncoras de rotina ("ao acordar", "antes de sair"...) e seus checklists. */
export class AnchorsRepo {
  constructor(private db: DB) {}

  list(date: string): Anchor[] {
    const anchors = this.db.prepare('SELECT id, key, title FROM anchors ORDER BY position').all() as { id: number; key: string; title: string }[]
    const items = this.db
      .prepare(
        `SELECT i.id, i.anchor_id, i.text, (c.item_id IS NOT NULL) AS done
           FROM anchor_items i LEFT JOIN anchor_checks c ON c.item_id = i.id AND c.date = ?
          ORDER BY i.position, i.id`,
      )
      .all(date) as { id: number; anchor_id: number; text: string; done: number }[]
    return anchors.map((a) => ({
      ...a,
      items: items.filter((i) => i.anchor_id === a.id).map((i) => ({ id: i.id, text: i.text, done: !!i.done })),
    }))
  }
  addItem(anchorId: number, text: string): boolean {
    if (!this.db.prepare('SELECT 1 FROM anchors WHERE id = ?').get(anchorId)) return false
    const pos = (this.db.prepare('SELECT COALESCE(MAX(position),0)+1 AS p FROM anchor_items WHERE anchor_id = ?').get(anchorId) as { p: number }).p
    this.db.prepare('INSERT INTO anchor_items (anchor_id, text, position) VALUES (?,?,?)').run(anchorId, text, pos)
    return true
  }
  deleteItem(id: number): boolean {
    return this.db.prepare('DELETE FROM anchor_items WHERE id = ?').run(id).changes > 0
  }
  check(itemId: number, date: string, done: boolean): boolean {
    if (!this.db.prepare('SELECT 1 FROM anchor_items WHERE id = ?').get(itemId)) return false
    if (done) this.db.prepare('INSERT OR IGNORE INTO anchor_checks (item_id, date) VALUES (?,?)').run(itemId, date)
    else this.db.prepare('DELETE FROM anchor_checks WHERE item_id = ? AND date = ?').run(itemId, date)
    return true
  }
}
