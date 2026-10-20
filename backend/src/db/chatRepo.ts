import type { DB } from './index'

export interface StoredMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

interface Row {
  id: number
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

const toMessage = (r: Row): StoredMessage => ({
  id: r.id,
  role: r.role,
  content: r.content,
  createdAt: r.created_at,
})

/** Acesso ao histórico do chat. Só esta classe conhece o SQL das mensagens. */
export class ChatRepo {
  constructor(private readonly db: DB) {}

  add(role: 'user' | 'assistant', content: string): StoredMessage {
    const info = this.db.prepare('INSERT INTO messages (role, content) VALUES (?, ?)').run(role, content)
    const row = this.db.prepare('SELECT * FROM messages WHERE id = ?').get(info.lastInsertRowid) as Row
    return toMessage(row)
  }

  /** As últimas `limit` mensagens, em ordem cronológica. */
  recent(limit: number): StoredMessage[] {
    const rows = this.db
      .prepare('SELECT * FROM (SELECT * FROM messages ORDER BY id DESC LIMIT ?) ORDER BY id ASC')
      .all(limit) as Row[]
    return rows.map(toMessage)
  }

  clear(): void {
    this.db.prepare('DELETE FROM messages').run()
  }
}
