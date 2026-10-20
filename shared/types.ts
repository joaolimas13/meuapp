// Tipos compartilhados entre frontend e backend (o formato dos dados da API).

/** Estados do orbe central. Cada um tem cor e animação próprias. */
export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'alert'

/** Quão insistente um lembrete deve ser (Fase 4: lembretes escalonados). */
export type Insistence = 'low' | 'medium' | 'max'

// ---------------------------------------------------------------- Tarefas

export type TaskPriority = 'high' | 'normal' | 'low'
export type TaskStatus = 'todo' | 'done' | 'cancelled'

export interface Task {
  id: number
  title: string
  description: string
  /** Horário local, sem fuso: "AAAA-MM-DD" (só data) ou "AAAA-MM-DDTHH:MM". */
  dueAt: string | null
  priority: TaskPriority
  category: string
  status: TaskStatus
  recurrence: string | null
  insistence: Insistence
  /** Se for um passo de outra tarefa, o id dela. */
  parentId: number | null
  position: number
  estMinutes: number | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
  /** Passos pequenos (5–15 min), em ordem. Vazio se não foi quebrada. */
  steps: Task[]
}

/** O que a tela principal precisa saber sobre "hoje". */
export interface TodayView {
  date: string
  time: string
  /** No máximo 3, em ordem de importância (redução de sobrecarga). */
  priorities: Task[]
  /** Atrasadas: viram "Remarcar?", nunca uma lista de fracassos. */
  overdue: Task[]
  /** Com horário ainda por vir hoje. */
  dueToday: Task[]
  /** O próximo compromisso com horário marcado. */
  nextEvent: Task | null
}

// ---------------------------------------------------------------- Memória e Caixa

export const MEMORY_CATEGORIES = [
  'pessoas',
  'projetos',
  'financas',
  'saude',
  'estudos',
  'ideias',
  'preferencias',
  'rotina',
  'notas',
] as const
export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number]

export interface Memory {
  id: number
  text: string
  category: MemoryCategory
  tags: string[]
  /** 1 (baixa) a 5 (sempre lembrar). */
  importance: number
  createdAt: string
  updatedAt: string
}

export interface InboxItem {
  id: number
  text: string
  status: 'pending' | 'done' | 'discarded'
  createdAt: string
}

export interface InboxSuggestion {
  id: number
  kind: 'task' | 'memory'
  title: string
  category: string
  dueAt: string | null
  source: 'ai' | 'heuristic'
}

// ---------------------------------------------------------------- Desenvolvimento pessoal

export interface DailyLog {
  date: string
  exercised: boolean
  exerciseNote: string
  studied: boolean
  studyHours: number | null
  pages: number
  sleepHours: number | null
  waterL: number
}

export interface Targets {
  sleepHours: number
  /** Dormir a partir de (meta − tolerância) já vale pontuação cheia. */
  sleepTolerance: number
  pages: number
  waterL: number
}

export interface Weights {
  goals: number
  sleep: number
  exercise: number
  study: number
  reading: number
}

export interface ScoreParts {
  goals: number
  sleep: number
  exercise: number
  study: number
  reading: number
}

export interface DayScore {
  total: number
  parts: ScoreParts
}

export interface GoalItem {
  /** null = meta automática (água), calculada pelos litros registrados. */
  id: number | null
  title: string
  kind: 'fixed' | 'daily' | 'auto'
  done: boolean
}

export interface DevStats {
  streak: number
  goodDayThreshold: number
  level: number
  xp: number
  xpInLevel: number
  xpPerLevel: number
  pagesTotal: number
  pagesMonth: number
  last7: { date: string; score: number }[]
}

export interface DevDay {
  date: string
  log: DailyLog
  goals: GoalItem[]
  targets: Targets
  weights: Weights
  score: DayScore
  stats: DevStats
}

// ---------------------------------------------------------------- Negócio (exemplo até a Fase 6)

export interface BusinessSummary {
  inProgress: number
  nextDelivery: string
  lowFilament: string
  pendingPayments: number
}
