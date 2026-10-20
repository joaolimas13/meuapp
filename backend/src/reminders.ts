import type { Alert, GeneralSettings, Task } from '../../shared/types'
import { inWindow, minutesBetween, nowDt, type LocalNow } from './lib/time'

/*
  LEMBRETES ESCALONADOS
  ---------------------
  Função pura (fácil de testar): dadas as tarefas com horário e a hora de agora,
  diz quais alertas estão ativos e em que nível.

  Antes do horário (insistência média/máxima): avisos discretos a 30, 15 e 5 min.
  Depois do horário, o alerta escala em degraus de "minutos desde o horário":
      0 → nível 1 (tela pulsa + som)       5 → nível 2 (o GAIA fala)
     15, 30, 60, 120, 240 → nível 3 (insistente, só insistência máxima)
  O teto de nível e por quanto tempo insiste dependem da insistência da tarefa:
      baixa  : nível 1, até 15 min    média : nível 2, até 60 min    máxima: nível 3, até 240 min
  Depois disso para de insistir; a tarefa vira "Remarcar?" na tela (sem culpa).
  Horário de silêncio / Não perturbe: tudo fica no nível 0 (só visual, discreto).
*/

const STEPS = [0, 5, 15, 30, 60, 120, 240] // degraus de repetição (intervalos crescentes)
const CAP = { low: 1, medium: 2, max: 3 } as const
const WINDOW = { low: 15, medium: 60, max: 240 } as const
const BEFORE = [30, 15, 5]

export function isQuiet(now: LocalNow, g: GeneralSettings): boolean {
  return g.dnd || inWindow(now.time, g.quietStart, g.quietEnd)
}

export function computeAlerts(tasks: Task[], now: LocalNow, g: GeneralSettings, snoozes: Map<number, string>): Alert[] {
  const quiet = isQuiet(now, g)
  const nowStr = nowDt(now)
  const out: Alert[] = []

  for (const t of tasks) {
    if (t.status !== 'todo' || t.parentId !== null || !t.dueAt || t.dueAt.length <= 10) continue
    const until = snoozes.get(t.id)
    if (until && until > nowStr) continue

    const diff = minutesBetween(t.dueAt, nowStr) // >0: já passou do horário
    const base = { taskId: t.id, title: t.title, dueAt: t.dueAt, insistence: t.insistence }

    if (diff < 0) {
      const remaining = -diff
      if (t.insistence === 'low' || remaining > BEFORE[0]) continue
      const slot = [...BEFORE].reverse().find((b) => remaining <= b)! // menor limite que ainda cobre
      out.push({ ...base, kind: 'before', level: 0, minutes: remaining, key: `${t.id}:before:${slot}` })
      continue
    }

    if (diff > WINDOW[t.insistence]) continue
    let idx = 0
    STEPS.forEach((s, i) => { if (diff >= s) idx = i })
    const raw = idx === 0 ? 1 : idx === 1 ? 2 : 3
    const level = (quiet ? 0 : Math.min(raw, CAP[t.insistence])) as Alert['level']
    out.push({ ...base, kind: 'due', level, minutes: diff, key: `${t.id}:due:${idx}` })
  }
  // Mais urgente primeiro: nível maior, depois horário mais antigo.
  return out.sort((a, b) => b.level - a.level || a.dueAt.localeCompare(b.dueAt))
}
