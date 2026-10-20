import type { Insistence, Task, TaskPriority, TaskStatus } from '../../../shared/types'
import type { DB } from './index'

interface Row {
  id: number
  title: string
  description: string
  due_at: string | null
  priority: TaskPriority
  category: string
  status: TaskStatus
  recurrence: string | null
  insistence: Insistence
  parent_id: number | null
  position: number
  est_minutes: number | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

const toTask = (r: Row, steps: Task[] = []): Task => ({
  id: r.id,
  title: r.title,
  description: r.description,
  dueAt: r.due_at,
  priority: r.priority,
  category: r.category,
  status: r.status,
  recurrence: r.recurrence,
  insistence: r.insistence,
  parentId: r.parent_id,
  position: r.position,
  estMinutes: r.est_minutes,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  completedAt: r.completed_at,
  steps,
})

export interface NewTask {
  title: string
  description?: string
  dueAt?: string | null
  priority?: TaskPriority
  category?: string
  recurrence?: string | null
  insistence?: Insistence
  estMinutes?: number | null
}

export interface TaskPatch extends Partial<NewTask> {
  status?: TaskStatus
}

export interface NewStep {
  title: string
  minutes?: number | null
}

const NOW = `strftime('%Y-%m-%dT%H:%M:%fZ','now')`

/** Tarefas, subtarefas e passos. Passos são tarefas com `parent_id`. */
export class TasksRepo {
  constructor(private readonly db: DB) {}

  create(input: NewTask, parentId: number | null = null, position = 0): Task {
    const info = this.db
      .prepare(
        `INSERT INTO tasks (title, description, due_at, priority, category, recurrence, insistence, parent_id, position, est_minutes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.title,
        input.description ?? '',
        input.dueAt ?? null,
        input.priority ?? 'normal',
        input.category ?? '',
        input.recurrence ?? null,
        input.insistence ?? 'medium',
        parentId,
        position,
        input.estMinutes ?? null,
      )
    return this.get(Number(info.lastInsertRowid))!
  }

  /** Cria a tarefa já com seus passos, tudo ou nada (transação). */
  createWithSteps(input: NewTask, steps: NewStep[] = []): Task {
    return this.db.transaction(() => {
      const t = this.create(input)
      if (steps.length) this.addSteps(t.id, steps)
      return this.get(t.id)!
    })()
  }

  /** Busca uma tarefa (ou passo) pelo id, já com seus passos. */
  get(id: number): Task | null {
    const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Row | undefined
    return row ? toTask(row, this.stepsOf(id)) : null
  }

  private stepsOf(parentId: number): Task[] {
    const rows = this.db
      .prepare('SELECT * FROM tasks WHERE parent_id = ? ORDER BY position ASC, id ASC')
      .all(parentId) as Row[]
    return rows.map((r) => toTask(r))
  }

  /** Tarefas de nível principal (sem passos soltos). `status: 'all'` traz tudo. */
  list(opts: { status?: TaskStatus | 'all'; limit?: number } = {}): Task[] {
    const status = opts.status ?? 'todo'
    const rows = (
      status === 'all'
        ? this.db.prepare('SELECT * FROM tasks WHERE parent_id IS NULL ORDER BY id DESC LIMIT ?').all(opts.limit ?? 500)
        : this.db
            .prepare('SELECT * FROM tasks WHERE parent_id IS NULL AND status = ? ORDER BY id DESC LIMIT ?')
            .all(status, opts.limit ?? 500)
    ) as Row[]
    return rows.map((r) => toTask(r, this.stepsOf(r.id)))
  }

  update(id: number, patch: TaskPatch): Task | null {
    const cur = this.get(id)
    if (!cur) return null
    const next = {
      title: patch.title ?? cur.title,
      description: patch.description ?? cur.description,
      dueAt: patch.dueAt === undefined ? cur.dueAt : patch.dueAt,
      priority: patch.priority ?? cur.priority,
      category: patch.category ?? cur.category,
      recurrence: patch.recurrence === undefined ? cur.recurrence : patch.recurrence,
      insistence: patch.insistence ?? cur.insistence,
      estMinutes: patch.estMinutes === undefined ? cur.estMinutes : patch.estMinutes,
      status: patch.status ?? cur.status,
    }
    this.db
      .prepare(
        `UPDATE tasks SET title=?, description=?, due_at=?, priority=?, category=?, recurrence=?, insistence=?,
           est_minutes=?, status=?, updated_at=${NOW},
           completed_at = CASE WHEN ? = 'done' AND completed_at IS NULL THEN ${NOW}
                               WHEN ? <> 'done' THEN NULL ELSE completed_at END
         WHERE id = ?`,
      )
      .run(
        next.title,
        next.description,
        next.dueAt,
        next.priority,
        next.category,
        next.recurrence,
        next.insistence,
        next.estMinutes,
        next.status,
        next.status,
        next.status,
        id,
      )
    return this.get(id)
  }

  /**
   * Conclui uma tarefa ou passo. Quando o último passo de uma tarefa é
   * concluído, a tarefa principal é concluída junto.
   * Devolve a tarefa, e `parentDone` = a tarefa principal que fechou junto (se houve).
   */
  complete(id: number): { task: Task; parentDone: Task | null } | null {
    const task = this.update(id, { status: 'done' })
    if (!task) return null
    let parentDone: Task | null = null
    if (task.parentId !== null) {
      const parent = this.get(task.parentId)
      if (parent && parent.status === 'todo' && parent.steps.every((s) => s.status !== 'todo')) {
        parentDone = this.update(parent.id, { status: 'done' })
      }
    }
    return { task: this.get(id)!, parentDone }
  }

  delete(id: number): boolean {
    return this.db.prepare('DELETE FROM tasks WHERE id = ?').run(id).changes > 0
  }

  /** Acrescenta passos ao fim da lista de passos da tarefa. */
  addSteps(parentId: number, steps: NewStep[]): Task[] {
    const base = (
      this.db.prepare('SELECT COALESCE(MAX(position), -1) AS m FROM tasks WHERE parent_id = ?').get(parentId) as { m: number }
    ).m
    const parent = this.get(parentId)
    return this.db.transaction(() =>
      steps.map((s, i) =>
        this.create({ title: s.title, estMinutes: s.minutes ?? null, insistence: parent?.insistence }, parentId, base + 1 + i),
      ),
    )()
  }
}

/** O próximo passo a fazer (o primeiro ainda pendente), ou null. */
export const nextStep = (t: Task): Task | null => t.steps.find((s) => s.status === 'todo') ?? null
