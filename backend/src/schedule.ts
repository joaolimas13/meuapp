import type { DailyReview, DayPlan, GeneralSettings, PlanBlock, Task } from '../../shared/types'
import { nextStep } from './db/tasksRepo'
import { addDays, addMinutes, minutesBetween, type LocalNow } from './lib/time'
import { isOverdue } from './planner'

/** Dia de plantão? Ciclo configurável (ex.: 1 dia de trabalho + 3 de folga = 24h/72h). */
export function isWorkDay(date: string, g: GeneralSettings): boolean {
  const { enabled, anchorDate, workDays, offDays } = g.shift
  if (!enabled || !anchorDate) return false
  const cycle = workDays + offDays
  const diff = minutesBetween(anchorDate, date) / 1440
  return (((diff % cycle) + cycle) % cycle) < workDays
}

const DAY_START = '08:00'
const DAY_END = '21:00'
const PRIORITY = { high: 0, normal: 1, low: 2 } as const

const taskMinutes = (t: Task) =>
  t.estMinutes ?? (t.steps.length ? Math.max(15, t.steps.filter((s) => s.status === 'todo').reduce((a, s) => a + (s.estMinutes ?? 10), 0)) : 30)

/**
 * Sugere uma ordem e blocos de tempo para o dia.
 * Tarefas com horário ficam onde estão; as demais (alta prioridade primeiro) preenchem os intervalos livres.
 * Em dia de plantão, no máximo 2 tarefas flexíveis (o resto fica fora do plano, sem culpa).
 */
export function planDay(open: Task[], date: string, now: LocalNow, g: GeneralSettings): DayPlan {
  const work = isWorkDay(date, g)
  const todo = open.filter((t) => t.status === 'todo' && t.parentId === null)
  const fixedTasks = todo.filter((t) => t.dueAt && t.dueAt.length > 10 && t.dueAt.slice(0, 10) === date)
  const fixed: PlanBlock[] = fixedTasks
    .map((t) => ({ taskId: t.id, title: t.title, start: t.dueAt!, end: addMinutes(t.dueAt!, taskMinutes(t)), fixed: true }))
    .sort((a, b) => a.start.localeCompare(b.start))

  const flexible = todo
    .filter((t) => !fixedTasks.includes(t) && (!t.dueAt || t.dueAt.slice(0, 10) <= date || isOverdue(t, now)))
    .sort((a, b) => PRIORITY[a.priority] - PRIORITY[b.priority] || (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999'))

  const startHm = date === now.date && now.time > DAY_START ? roundUp5(now.time) : DAY_START
  let cursor = `${date}T${startHm}`
  const limit = `${date}T${DAY_END}`
  const blocks = [...fixed]
  const unplaced: DayPlan['unplaced'] = []
  const cap = work ? 2 : Infinity
  let placed = 0

  for (const t of flexible) {
    const dur = taskMinutes(t)
    let start = cursor
    for (let guard = 0; guard < 50; guard++) {
      const end = addMinutes(start, dur)
      const clash = fixed.find((f) => start < f.end && end > f.start)
      if (!clash) break
      start = clash.end
    }
    const end = addMinutes(start, dur)
    if (placed >= cap || end > limit) {
      unplaced.push({ taskId: t.id, title: t.title })
      continue
    }
    blocks.push({ taskId: t.id, title: t.title, start, end, fixed: false })
    cursor = end
    placed++
  }
  blocks.sort((a, b) => a.start.localeCompare(b.start))
  return { date, workDay: work, blocks, unplaced }
}

function roundUp5(hm: string): string {
  const [h, m] = hm.split(':').map(Number)
  const t = Math.ceil((h * 60 + m) / 5) * 5
  const hh = Math.min(23, Math.floor(t / 60))
  return `${String(hh).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

/** Revisão do dia: o que foi feito, o que vira "Remarcar?" e o que olhar amanhã. Tom sem cobrança. */
export function dailyReview(open: Task[], doneToday: Task[], now: LocalNow, score: number): DailyReview {
  const todo = open.filter((t) => t.status === 'todo' && t.parentId === null)
  const toReschedule = todo.filter((t) => isOverdue(t, now)).map((t) => ({ id: t.id, title: t.title }))
  const tomorrowDate = addDays(now.date, 1)
  const tomorrow = todo
    .filter((t) => !t.dueAt || t.dueAt.slice(0, 10) <= tomorrowDate)
    .sort((a, b) => PRIORITY[a.priority] - PRIORITY[b.priority])
    .slice(0, 3)
    .map((t) => {
      const st = nextStep(t)
      return st ? `${t.title} — começar por: ${st.title}` : t.title
    })
  return { date: now.date, done: doneToday.map((t) => t.title), pending: todo.length, toReschedule, tomorrow, score }
}
