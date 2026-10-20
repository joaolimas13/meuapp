import type { Checkin, CheckinSummary, Task, WeeklyReview, WellbeingSummary } from '../../shared/types'
import { addDays, addMinutes, localNow, minutesBetween, nowDt } from './lib/time'
import { isWorkDay } from './schedule'
import type { Services } from './services'

// ------------------------------------------------------------------ revisão espaçada (Leitner)

/** Dias até a próxima revisão em cada caixa (0 a 4). */
export const LEITNER_DAYS = [1, 3, 7, 14, 30] as const

/**
 * Atualiza a caixa depois de uma revisão.
 * errei → volta à caixa 0 (revê amanhã) · difícil → fica na caixa · acertei → sobe uma caixa.
 */
export function reviewCard(box: number, result: 'wrong' | 'hard' | 'right', today: string): { box: number; next: string } {
  const b = result === 'wrong' ? 0 : result === 'hard' ? box : Math.min(box + 1, LEITNER_DAYS.length - 1)
  return { box: b, next: addDays(today, LEITNER_DAYS[b]) }
}

// ------------------------------------------------------------------ energia e humor

const BLOCKS = [
  { from: 6, to: 9 }, { from: 9, to: 12 }, { from: 12, to: 15 }, { from: 15, to: 18 }, { from: 18, to: 21 }, { from: 21, to: 24 },
]
const blockLabel = (b: { from: number; to: number }) => `${b.from}h–${b.to}h`

export function checkinSummary(history: Checkin[], now: { date: string; time: string }): CheckinSummary {
  const hourOf = (c: Checkin) => Number(c.time.slice(0, 2))
  const blocks = BLOCKS.map((b) => {
    const list = history.filter((c) => hourOf(c) >= b.from && hourOf(c) < b.to)
    return { label: blockLabel(b), n: list.length, avgEnergy: list.length ? Math.round((list.reduce((a, c) => a + c.energy, 0) / list.length) * 10) / 10 : 0 }
  }).filter((b) => b.n > 0)

  // Só sugere com dados suficientes: pelo menos 6 check-ins e 2 no bloco vencedor.
  const best = history.length >= 6 ? [...blocks].filter((b) => b.n >= 2).sort((a, b) => b.avgEnergy - a.avgEnergy)[0] ?? null : null
  const last = history.at(-1) ?? null
  const today = history.filter((c) => c.date === now.date)
  const hour = Number(now.time.slice(0, 2))
  const sinceLast = last ? minutesBetween(`${last.date}T${last.time}`, `${now.date}T${now.time}`) : Infinity
  // "Uma ou duas vezes ao dia": no máximo 2 por dia, com 5 h de intervalo, em horário razoável.
  const due = hour >= 7 && hour < 22 && today.length < 2 && sinceLast >= 300

  const suggestion = best
    ? `Seus melhores horários costumam ser ${best.label} (energia média ${String(best.avgEnergy).replace('.', ',')}). Vale encaixar aí as tarefas mais difíceis.`
    : history.length < 6
      ? `Com mais alguns check-ins (${history.length}/6) o GAIA descobre seus melhores horários.`
      : 'Ainda não há dados suficientes em um mesmo horário para sugerir.'
  return { due, last, today, blocks, best, suggestion }
}

// ------------------------------------------------------------------ sequências e mensagem

export function routineStreak(days: string[], today: string): number {
  const set = new Set(days)
  let d = set.has(today) ? today : addDays(today, -1) // hoje ainda pode ser cumprido: não quebra a sequência
  let n = 0
  while (set.has(d)) {
    n++
    d = addDays(d, -1)
  }
  return n
}

export function encouragement(p: { routineStreak: number; evolutionStreak: number; tasksDoneToday: number }): string {
  if (p.tasksDoneToday >= 3) return 'Dia produtivo. Aproveite o embalo, ou descanse sem culpa.'
  if (p.routineStreak >= 3) return `${p.routineStreak} dias seguidos de rotina. Isso é constância de verdade.`
  if (p.evolutionStreak >= 3) return `${p.evolutionStreak} dias seguidos de evolução. Continue assim.`
  if (p.routineStreak === 0 && p.evolutionStreak === 0) return 'Recomeçar é parte do processo. Um passo pequeno hoje já conta.'
  return 'Bom ritmo. Um passo de cada vez.'
}

const localDateOf = (s: Services, iso: string) => localNow(s.config.timezone, new Date(iso)).date

function doneTasksBetween(s: Services, from: string, to: string): Task[] {
  return s.tasks
    .list({ status: 'done' })
    .filter((t) => t.parentId === null && t.completedAt)
    .filter((t) => {
      const d = localDateOf(s, t.completedAt!)
      return d >= from && d <= to
    })
}

export function wellbeingSummary(s: Services): WellbeingSummary {
  const now = s.local()
  const rDays = s.wellbeing.routineDays(addDays(now.date, -60), now.date)
  const week = doneTasksBetween(s, addDays(now.date, -6), now.date)
  const today = week.filter((t) => localDateOf(s, t.completedAt!) === now.date).length
  const rs = routineStreak(rDays, now.date)
  const evo = s.dev.stats(now.date).streak
  return {
    routineStreak: rs,
    routineDays7: rDays.filter((d) => d >= addDays(now.date, -6)).length,
    tasksDoneToday: today,
    tasksDoneWeek: week.length,
    pointsToday: today * 10,
    evolutionStreak: evo,
    message: encouragement({ routineStreak: rs, evolutionStreak: evo, tasksDoneToday: today }),
  }
}

// ------------------------------------------------------------------ revisão semanal

export function weeklyReview(s: Services): WeeklyReview {
  const now = s.local()
  const from = addDays(now.date, -6)
  const dates = Array.from({ length: 7 }, (_, i) => addDays(from, i))
  const done = doneTasksBetween(s, from, now.date)
  const open = s.tasks.list({ status: 'todo' }).filter((t) => t.parentId === null)
  const overdue = open.filter((t) => t.dueAt && t.dueAt.slice(0, 10) < now.date)

  const days = dates.map((date) => ({ date, score: s.dev.scoreFor(date).total, log: s.dev.repo.getLog(date) }))
  const active = days.filter((d) => d.score > 0)
  const avgScore = active.length ? Math.round(active.reduce((a, d) => a + d.score, 0) / active.length) : 0
  const best = [...days].sort((a, b) => b.score - a.score)[0]
  const sleeps = days.map((d) => d.log.sleepHours).filter((v): v is number => v !== null)
  const checkins = s.wellbeing.checkinsBetween(from, now.date)
  const routine = s.wellbeing.routineDays(from, now.date)
  const posts = s.wellbeing.postedAtList().filter((iso) => {
    const d = localDateOf(s, iso)
    return d >= from && d <= now.date
  }).length

  const r: WeeklyReview = {
    from,
    to: now.date,
    tasksDone: done.length,
    pending: open.length,
    toReschedule: overdue.length,
    avgScore,
    goodDays: days.filter((d) => d.score >= 60).length,
    bestDay: best && best.score > 0 ? { date: best.date, score: best.score } : null,
    pages: days.reduce((a, d) => a + d.log.pages, 0),
    avgSleep: sleeps.length ? Math.round((sleeps.reduce((a, v) => a + v, 0) / sleeps.length) * 10) / 10 : null,
    studyHours: Math.round(days.reduce((a, d) => a + (d.log.studyHours ?? 0), 0) * 10) / 10,
    avgEnergy: checkins.length ? Math.round((checkins.reduce((a, c) => a + c.energy, 0) / checkins.length) * 10) / 10 : null,
    routineDays: routine.length,
    postsPosted: posts,
    highlights: [],
    nextWeek: open
      .sort((a, b) => ({ high: 0, normal: 1, low: 2 })[a.priority] - ({ high: 0, normal: 1, low: 2 })[b.priority] || (a.dueAt ?? '9').localeCompare(b.dueAt ?? '9'))
      .slice(0, 3)
      .map((t) => t.title),
  }
  // Tom construtivo: começa pelo que deu certo, nunca lista fracassos.
  if (r.tasksDone > 0) r.highlights.push(`Você concluiu ${r.tasksDone} tarefa(s).`)
  if (r.goodDays > 0) r.highlights.push(`${r.goodDays} dia(s) bons na evolução${r.bestDay ? `; o melhor foi ${r.bestDay.date.slice(8, 10)}/${r.bestDay.date.slice(5, 7)} com ${r.bestDay.score} pontos` : ''}.`)
  if (r.pages > 0) r.highlights.push(`${r.pages} páginas lidas.`)
  if (r.routineDays > 0) r.highlights.push(`Rotina cumprida em ${r.routineDays} dia(s).`)
  if (r.postsPosted > 0) r.highlights.push(`${r.postsPosted} post(s) publicados.`)
  if (r.avgSleep !== null) r.highlights.push(`Sono médio de ${String(r.avgSleep).replace('.', ',')} h.`)
  if (r.highlights.length === 0) r.highlights.push('Semana mais quieta. Tudo bem: recomeçar com um passo pequeno já conta.')
  return r
}

// ------------------------------------------------------------------ tarefas geradas automaticamente

/** Se o horário já passou há mais de `graceMin`, usa agora+2 min (para ainda avisar); senão o horário marcado. */
function dueAtOrSoon(date: string, time: string, nowTime: string, graceMin: number): string {
  const planned = `${date}T${time}`
  const diff = minutesBetween(planned, `${date}T${nowTime}`)
  return diff > graceMin ? addMinutes(`${date}T${nowTime}`, 2) : planned
}

/**
 * Cria, uma vez por dia, as tarefas automáticas: treino do dia (fora de plantão), "hora de desacelerar",
 * revisão semanal e revisão mensal do cofre de ideias. Idempotente: a tabela generated_tasks impede duplicar.
 */
export function ensureDaily(s: Services): void {
  const now = s.local()
  const g = s.settings.general()
  const dow = new Date(`${now.date}T12:00:00Z`).getUTCDay()
  const w = s.wellbeing

  if (!isWorkDay(now.date, g)) {
    for (const t of w.training().filter((e) => e.weekday === dow)) {
      if (!w.claim(`train:${t.id}`, now.date)) continue
      // Treino que o dia já "passou" (mais de 2 h) não vira cobrança: simplesmente não aparece.
      if (minutesBetween(`${now.date}T${t.time}`, nowDt(now)) > 120) continue
      s.tasks.create({ title: `Treino: ${t.title}`, dueAt: `${now.date}T${t.time}`, category: 'treino', insistence: 'medium', priority: 'normal' })
    }
  }

  if (g.sleep.enabled && w.claim('sleep', now.date)) {
    if (minutesBetween(`${now.date}T${g.sleep.windDown}`, nowDt(now)) <= 120) {
      s.tasks.create({
        title: 'Hora de desacelerar',
        description: 'Luz baixa, sem telas e o checklist "Antes de dormir" (aba Rotina).',
        dueAt: `${now.date}T${g.sleep.windDown}`,
        category: 'sono',
        insistence: 'medium',
      })
    }
  }

  if (g.weekly.enabled && dow === g.weekly.day && w.claim('weekly', now.date)) {
    s.tasks.create({ title: 'Revisão da semana', description: 'Abra a aba Dia para ver o resumo da semana.', dueAt: dueAtOrSoon(now.date, g.weekly.time, now.time, 180), category: 'revisao', insistence: 'low' })
  }

  const month = `${now.date.slice(0, 7)}-01`
  if (w.openVaultCount() > 0 && w.claim('vault', month)) {
    s.tasks.create({ title: `Revisar o cofre de ideias (${w.openVaultCount()})`, description: 'Para cada ideia: executar, adiar ou descartar.', dueAt: dueAtOrSoon(now.date, '10:00', now.time, 180), category: 'cofre', insistence: 'low' })
  }
}
