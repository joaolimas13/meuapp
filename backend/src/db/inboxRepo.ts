import type { InboxItem } from '../../../shared/types'
import type { DB } from './index'

interface Row {
  id: number
  text: string
  status: InboxItem['status']
  created_at: string
}

const toItem = (r: Row): InboxItem => ({ id: r.id, text: r.text, status: r.status, createdAt: r.created_at })

/** Caixa de Entrada: captura rápida, sem categoria nem prazo. Organiza-se depois. */
export class InboxRepo {
  constructor(private readonly db: DB) {}

  add(text: string): InboxItem {
    const info = this.db.prepare('INSERT INTO inbox (text) VALUES (?)').run(text)
    return this.get(Number(info.lastInsertRowid))!
  }

  get(id: number): InboxItem | null {
    const row = this.db.prepare('SELECT * FROM inbox WHERE id = ?').get(id) as Row | undefined
    return row ? toItem(row) : null
  }

  pending(): InboxItem[] {
    return (this.db.prepare("SELECT * FROM inbox WHERE status = 'pending' ORDER BY id ASC").all() as Row[]).map(toItem)
  }

  setStatus(id: number, status: InboxItem['status']): boolean {
    return this.db.prepare('UPDATE inbox SET status = ? WHERE id = ?').run(status, id).changes > 0
  }
}
