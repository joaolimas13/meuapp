import { MEMORY_CATEGORIES, type Memory, type MemoryCategory } from '../../../shared/types'
import { norm } from '../lib/time'
import type { DB } from './index'

interface Row {
  id: number
  text: string
  category: string
  tags: string
  importance: number
  created_at: string
  updated_at: string
}

const asCategory = (c: string): MemoryCategory =>
  (MEMORY_CATEGORIES as readonly string[]).includes(c) ? (c as MemoryCategory) : 'notas'

const toMemory = (r: Row): Memory => ({
  id: r.id,
  text: r.text,
  category: asCategory(r.category),
  tags: JSON.parse(r.tags) as string[],
  importance: r.importance,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

export interface NewMemory {
  text: string
  category?: string
  tags?: string[]
  importance?: number
}

const NOW = `strftime('%Y-%m-%dT%H:%M:%fZ','now')`
const STOP = new Set(['para', 'com', 'uma', 'que', 'por', 'dos', 'das', 'nos', 'nas', 'the', 'meu', 'minha', 'qual', 'quem', 'como'])

/** Quebra um texto em palavras úteis para busca (sem acentos, sem palavras comuns). */
export function tokens(s: string): string[] {
  return norm(s)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !STOP.has(w))
}

/**
 * Memórias pessoais. A busca é por palavras (ignora acentos e maiúsculas).
 * É simples de propósito: a interface `search` pode ser trocada por busca
 * semântica (embeddings) no futuro sem mudar quem a chama.
 */
export class MemoriesRepo {
  constructor(private readonly db: DB) {}

  add(input: NewMemory): Memory {
    const info = this.db
      .prepare('INSERT INTO memories (text, category, tags, importance) VALUES (?, ?, ?, ?)')
      .run(input.text, asCategory(input.category ?? 'notas'), JSON.stringify(input.tags ?? []), input.importance ?? 3)
    return this.get(Number(info.lastInsertRowid))!
  }

  get(id: number): Memory | null {
    const row = this.db.prepare('SELECT * FROM memories WHERE id = ?').get(id) as Row | undefined
    return row ? toMemory(row) : null
  }

  update(id: number, patch: Partial<NewMemory>): Memory | null {
    const cur = this.get(id)
    if (!cur) return null
    this.db
      .prepare(`UPDATE memories SET text=?, category=?, tags=?, importance=?, updated_at=${NOW} WHERE id=?`)
      .run(
        patch.text ?? cur.text,
        asCategory(patch.category ?? cur.category),
        JSON.stringify(patch.tags ?? cur.tags),
        patch.importance ?? cur.importance,
        id,
      )
    return this.get(id)
  }

  delete(id: number): boolean {
    return this.db.prepare('DELETE FROM memories WHERE id = ?').run(id).changes > 0
  }

  list(category?: string): Memory[] {
    const rows = (
      category
        ? this.db.prepare('SELECT * FROM memories WHERE category = ? ORDER BY updated_at DESC').all(category)
        : this.db.prepare('SELECT * FROM memories ORDER BY updated_at DESC').all()
    ) as Row[]
    return rows.map(toMemory)
  }

  /** Memórias que combinam com a consulta, das mais relevantes para as menos. */
  search(query: string, opts: { category?: string; limit?: number } = {}): Memory[] {
    const q = tokens(query)
    if (q.length === 0) return []
    const scored = this.list(opts.category)
      .map((m) => {
        const hay = tokens(`${m.text} ${m.tags.join(' ')} ${m.category}`)
        const hits = q.filter((w) => hay.some((h) => h === w || h.startsWith(w) || w.startsWith(h))).length
        return { m, score: hits === 0 ? 0 : hits + m.importance * 0.1 }
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
    return scored.slice(0, opts.limit ?? 10).map((x) => x.m)
  }

  /** As memórias marcadas como "sempre lembrar" (importância 5). */
  pinned(limit = 5): Memory[] {
    return (
      this.db.prepare('SELECT * FROM memories WHERE importance = 5 ORDER BY updated_at DESC LIMIT ?').all(limit) as Row[]
    ).map(toMemory)
  }

  toMarkdown(): string {
    const byCat = new Map<string, Memory[]>()
    for (const m of this.list()) byCat.set(m.category, [...(byCat.get(m.category) ?? []), m])
    const out = ['# Memórias do GAIA', '']
    for (const [cat, items] of byCat) {
      out.push(`## ${cat}`, '')
      for (const m of items) {
        const tags = m.tags.length ? ` _(${m.tags.join(', ')})_` : ''
        out.push(`- ${m.text}${tags} — importância ${m.importance}, atualizada em ${m.updatedAt.slice(0, 10)}`)
      }
      out.push('')
    }
    return out.join('\n')
  }
}
