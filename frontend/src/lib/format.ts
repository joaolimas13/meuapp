import type { Task } from '../../../shared/types'

/** O primeiro passo ainda pendente de uma tarefa (para mostrar "um passo de cada vez"). */
export const nextStep = (t: Task): Task | null => t.steps.find((s) => s.status === 'todo') ?? null

/** Soma dias a uma data AAAA-MM-DD. */
export function addDaysStr(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** "hoje 17:00", "amanhã", "ontem 09:00" ou "22/10 10:00". */
export function formatDue(dueAt: string | null, today: string): string {
  if (!dueAt) return ''
  const d = dueAt.slice(0, 10)
  const time = dueAt.length > 10 ? dueAt.slice(11, 16) : ''
  const day =
    d === today
      ? 'hoje'
      : d === addDaysStr(today, 1)
        ? 'amanhã'
        : d === addDaysStr(today, -1)
          ? 'ontem'
          : `${d.slice(8, 10)}/${d.slice(5, 7)}`
  return time ? `${day} ${time}` : day
}

/** Data local do navegador a partir de "AAAA-MM-DDTHH:MM" (sem fuso = horário local). */
export const dueToDate = (dueAt: string) => new Date(dueAt.length > 10 ? dueAt : `${dueAt}T00:00`)

/** Dia da semana e data por extenso: "terça-feira, 20 de outubro". */
export const longDate = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
