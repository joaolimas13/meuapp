import type { DailyLog, DayScore, Targets, Weights } from '../../../shared/types'

/*
  PONTUAÇÃO DO DIA (0 a 100)
  --------------------------
  Funções puras: recebem números e devolvem números, sem banco nem relógio.
  Isso facilita testar e ajustar as regras.

  Pesos padrão:  metas 40 · sono 20 · exercício 15 · estudo 15 · leitura 10
  Zero culpa: nunca há pontos negativos. Dia sem registro vale 0, não "falha".
*/

export const DEFAULT_TARGETS: Targets = { sleepHours: 8, sleepTolerance: 1, pages: 30, waterL: 2 }
export const DEFAULT_WEIGHTS: Weights = { goals: 40, sleep: 20, exercise: 15, study: 15, reading: 10 }

/** Um dia com nota a partir daqui conta como "dia bom" para a sequência. */
export const GOOD_DAY = 60
export const XP_PER_LEVEL = 500

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
const round1 = (n: number) => Math.round(n * 10) / 10

export interface ScoreInput {
  log: DailyLog
  /** Metas batidas e total de metas do dia (incluindo a meta automática da água). */
  goals: { done: number; total: number }
}

export function computeScore(input: ScoreInput, targets: Targets, weights: Weights): DayScore {
  const { log, goals } = input

  const goalsFrac = goals.total > 0 ? goals.done / goals.total : 0

  // Sono: pontuação cheia a partir de (meta − tolerância), proporcional abaixo disso.
  // Dormir mais que a meta não é penalizado.
  const sleepFloor = Math.max(0.1, targets.sleepHours - targets.sleepTolerance)
  const sleepFrac = log.sleepHours == null ? 0 : clamp01(log.sleepHours / sleepFloor)

  const readingFrac = targets.pages > 0 ? clamp01(log.pages / targets.pages) : 0

  const parts = {
    goals: round1(weights.goals * goalsFrac),
    sleep: round1(weights.sleep * sleepFrac),
    exercise: log.exercised ? weights.exercise : 0,
    study: log.studied ? weights.study : 0,
    reading: round1(weights.reading * readingFrac),
  }
  const total = Math.round(parts.goals + parts.sleep + parts.exercise + parts.study + parts.reading)
  return { total, parts }
}

/**
 * Sequência de dias bons. `scores` mapeia data → nota.
 * O dia de hoje ainda em andamento não quebra a sequência: se hoje ainda não
 * é um dia bom, contamos a partir de ontem.
 */
export function streak(scores: Map<string, number>, today: string, addDays: (d: string, n: number) => string): number {
  let day = (scores.get(today) ?? 0) >= GOOD_DAY ? today : addDays(today, -1)
  let n = 0
  while ((scores.get(day) ?? 0) >= GOOD_DAY) {
    n++
    day = addDays(day, -1)
  }
  return n
}

export function levelOf(xp: number) {
  const level = 1 + Math.floor(xp / XP_PER_LEVEL)
  return { level, xpInLevel: xp % XP_PER_LEVEL, xpPerLevel: XP_PER_LEVEL }
}
