import type { Task, TodayView } from '../../shared/types'
import { nextStep } from './db/tasksRepo'
import { dueDate, dueTime, type LocalNow } from './lib/time'

const PRIORITY_RANK = { high: 0, normal: 1, low: 2 } as const

const byDueThenPriority = (a: Task, b: Task) =>
  (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999') || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
const byPriorityThenDue = (a: Task, b: Task) =>
  PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999')

/** True se a tarefa já passou do prazo (data anterior a hoje, ou hoje com horário que já passou). */
export function isOverdue(t: Task, now: LocalNow): boolean {
  if (!t.dueAt) return false
  const d = dueDate(t.dueAt)
  if (d < now.date) return true
  const time = dueTime(t.dueAt)
  return d === now.date && time !== null && time < now.time
}

/**
 * Monta a visão de "hoje" a partir das tarefas em aberto.
 * - priorities: no máximo 3 (as de hoje primeiro, depois as sem data), para não sobrecarregar.
 * - overdue: vira "Remarcar?" na tela, nunca uma lista de fracassos.
 */
export function buildToday(openTasks: Task[], now: LocalNow): TodayView {
  const open = openTasks.filter((t) => t.status === 'todo')
  const overdue = open.filter((t) => isOverdue(t, now)).sort(byDueThenPriority)
  const dueToday = open
    .filter((t) => t.dueAt && dueDate(t.dueAt) === now.date && !isOverdue(t, now))
    .sort(byDueThenPriority)
  const undated = open.filter((t) => !t.dueAt).sort(byPriorityThenDue)

  const priorities = [...[...dueToday].sort(byPriorityThenDue), ...undated].slice(0, 3)

  const nextEvent = dueToday.find((t) => dueTime(t.dueAt!) !== null) ?? null

  return { date: now.date, time: now.time, priorities, overdue, dueToday, nextEvent }
}

/** Texto curto para o GAIA "enxergar" uma tarefa (usado no contexto da IA). */
export function describeTask(t: Task, now: LocalNow): string {
  const bits: string[] = []
  if (t.dueAt) {
    const d = dueDate(t.dueAt)
    const time = dueTime(t.dueAt)
    bits.push(d === now.date ? `hoje${time ? ` ${time}` : ''}` : `${d}${time ? ` ${time}` : ''}`)
  }
  if (t.priority === 'high') bits.push('prioridade alta')
  const step = nextStep(t)
  if (step) bits.push(`próximo passo: ${step.title}`)
  return `#${t.id} ${t.title}${bits.length ? ` (${bits.join(', ')})` : ''}`
}
