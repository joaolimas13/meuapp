import type { DevDay, DevStats, GoalItem } from '../../../shared/types'
import { DevRepo } from '../db/devRepo'
import { addDays } from '../lib/time'
import { computeScore, GOOD_DAY, levelOf, streak } from './score'

/** Junta registro do dia + metas + pontuação + estatísticas (sequência, nível, páginas). */
export class DevService {
  constructor(readonly repo: DevRepo) {}

  /** Metas do dia, com a meta automática da água sempre presente. */
  private goalItems(date: string): GoalItem[] {
    const { waterL } = this.repo.targets()
    const log = this.repo.getLog(date)
    const water: GoalItem = {
      id: null,
      title: `Beber ${String(waterL).replace('.', ',')} L de água`,
      kind: 'auto',
      done: log.waterL >= waterL,
    }
    const own: GoalItem[] = this.repo.goalsFor(date).map((g) => ({ id: g.id, title: g.title, kind: g.kind, done: g.done }))
    return [water, ...own]
  }

  scoreFor(date: string) {
    const goals = this.goalItems(date)
    return computeScore(
      { log: this.repo.getLog(date), goals: { done: goals.filter((g) => g.done).length, total: goals.length } },
      this.repo.targets(),
      this.repo.weights(),
    )
  }

  stats(today: string): DevStats {
    // Pontuação de cada dia com alguma atividade, do primeiro até hoje.
    const scores = new Map<string, number>()
    for (const d of this.repo.activeDates()) if (d <= today) scores.set(d, this.scoreFor(d).total)
    if (!scores.has(today)) scores.set(today, this.scoreFor(today).total)

    const xp = [...scores.values()].reduce((a, b) => a + b, 0)
    const monthStart = `${today.slice(0, 7)}-01`
    return {
      streak: streak(scores, today, addDays),
      goodDayThreshold: GOOD_DAY,
      ...(({ level, xpInLevel, xpPerLevel }) => ({ level, xpInLevel, xpPerLevel }))(levelOf(xp)),
      xp,
      pagesTotal: this.repo.pages(),
      pagesMonth: this.repo.pages(monthStart, today),
      last7: Array.from({ length: 7 }, (_, i) => {
        const date = addDays(today, i - 6)
        return { date, score: scores.get(date) ?? this.scoreFor(date).total }
      }),
    }
  }

  day(date: string, today: string): DevDay {
    return {
      date,
      log: this.repo.getLog(date),
      goals: this.goalItems(date),
      targets: this.repo.targets(),
      weights: this.repo.weights(),
      score: this.scoreFor(date),
      stats: this.stats(today),
    }
  }
}
