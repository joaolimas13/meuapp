import { CONTENT_STEPS, type ContentKind, type ContentPost, type ContentStep } from '../../../shared/types'
import type { DB } from '.'

interface Row { id: number; title: string; kind: ContentKind; product: string; notes: string; date: string | null; steps: string; posted_at: string | null; created_at: string }

const toPost = (r: Row): ContentPost => {
  const steps = (JSON.parse(r.steps) as ContentStep[]).filter((s) => CONTENT_STEPS.includes(s))
  return { id: r.id, title: r.title, kind: r.kind, product: r.product, notes: r.notes, date: r.date, steps, posted: r.posted_at !== null, createdAt: r.created_at }
}

export interface NewPost { title: string; kind?: ContentKind; product?: string; notes?: string; date?: string | null }

/** Calendário de conteúdo: posts com data e banco de ideias (sem data). */
export class ContentRepo {
  constructor(private db: DB) {}

  get(id: number): ContentPost | null {
    const r = this.db.prepare('SELECT * FROM content_posts WHERE id = ?').get(id) as Row | undefined
    return r ? toPost(r) : null
  }
  /** Posts com data entre `from` e `to` (inclusive), e todas as ideias sem data. */
  list(from: string, to: string): { posts: ContentPost[]; ideas: ContentPost[] } {
    const posts = this.db.prepare('SELECT * FROM content_posts WHERE date BETWEEN ? AND ? ORDER BY date, id').all(from, to) as Row[]
    const ideas = this.db.prepare('SELECT * FROM content_posts WHERE date IS NULL AND posted_at IS NULL ORDER BY id DESC').all() as Row[]
    return { posts: posts.map(toPost), ideas: ideas.map(toPost) }
  }
  create(p: NewPost): ContentPost {
    const id = this.db
      .prepare('INSERT INTO content_posts (title, kind, product, notes, date) VALUES (?,?,?,?,?)')
      .run(p.title, p.kind ?? 'reel', p.product ?? '', p.notes ?? '', p.date ?? null).lastInsertRowid as number
    return this.get(id)!
  }
  update(id: number, p: Partial<NewPost>): ContentPost | null {
    const cur = this.get(id)
    if (!cur) return null
    this.db
      .prepare('UPDATE content_posts SET title = ?, kind = ?, product = ?, notes = ?, date = ? WHERE id = ?')
      .run(p.title ?? cur.title, p.kind ?? cur.kind, p.product ?? cur.product, p.notes ?? cur.notes, p.date === undefined ? cur.date : p.date, id)
    return this.get(id)
  }
  /** Marca/desmarca uma etapa. "postado" registra o dia em que foi postado. */
  setStep(id: number, step: ContentStep, done: boolean, nowIso: string): ContentPost | null {
    const cur = this.get(id)
    if (!cur) return null
    const set = new Set(cur.steps)
    if (done) set.add(step)
    else set.delete(step)
    const steps = CONTENT_STEPS.filter((s) => set.has(s)) // mantém a ordem da produção
    const posted = set.has('postado')
    this.db
      .prepare('UPDATE content_posts SET steps = ?, posted_at = ? WHERE id = ?')
      .run(JSON.stringify(steps), posted ? (cur.posted ? this.postedAt(id) : nowIso) : null, id)
    return this.get(id)
  }
  private postedAt(id: number): string | null {
    return (this.db.prepare('SELECT posted_at FROM content_posts WHERE id = ?').get(id) as { posted_at: string | null }).posted_at
  }
  delete(id: number): boolean {
    return this.db.prepare('DELETE FROM content_posts WHERE id = ?').run(id).changes > 0
  }
  /** Quantos posts foram postados com data `date` (para saber se hoje já foi cumprido). */
  postedOn(date: string): number {
    return (this.db.prepare('SELECT COUNT(*) AS n FROM content_posts WHERE date = ? AND posted_at IS NOT NULL').get(date) as { n: number }).n
  }
  /** Postou algo hoje, mesmo que o post estivesse planejado para outro dia? (compara o dia local) */
  postedAtLocalDay(date: string, toLocalDate: (iso: string) => string): boolean {
    const rows = this.db.prepare('SELECT posted_at FROM content_posts WHERE posted_at IS NOT NULL ORDER BY posted_at DESC LIMIT 20').all() as { posted_at: string }[]
    return rows.some((r) => toLocalDate(r.posted_at) === date)
  }
}
