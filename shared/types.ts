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

// ---------------------------------------------------------------- Fase 4: alertas, foco, âncoras, plano

/** Um alerta ativo agora. `level`: 0 discreto · 1 tela pulsa + som · 2 GAIA fala · 3 insistente. */
export interface Alert {
  taskId: number
  title: string
  dueAt: string
  kind: 'before' | 'due'
  level: 0 | 1 | 2 | 3
  /** before: minutos que faltam · due: minutos desde o horário. */
  minutes: number
  insistence: Insistence
  /** Muda a cada escalonamento: a tela só toca/fala de novo quando a chave muda. */
  key: string
}

export interface AlertsView {
  alerts: Alert[]
  quiet: boolean
  now: string
}

export interface FocusSession {
  id: number
  taskId: number | null
  title: string
  minutes: number
  breakMinutes: number
  startedAt: string
  endedAt: string | null
  outcome: string | null
}

export interface FocusView {
  session: FocusSession | null
  /** Hora do servidor (ISO), para o relógio do navegador não desalinhar o timer. */
  serverNow: string
}

/** "Onde eu parei": o ponto de retomada salvo ao terminar/interromper um bloco. */
export interface Bridge {
  id: number
  taskId: number | null
  title: string
  note: string
  nextStep: string
  createdAt: string
}

export interface AnchorItem {
  id: number
  text: string
  done: boolean
}

export interface Anchor {
  id: number
  key: string
  title: string
  items: AnchorItem[]
}

export interface PlanBlock {
  taskId: number
  title: string
  start: string
  end: string
  /** true = tem horário marcado (não se move). */
  fixed: boolean
}

export interface DayPlan {
  date: string
  workDay: boolean
  blocks: PlanBlock[]
  unplaced: { taskId: number; title: string }[]
}

export interface DailyReview {
  date: string
  done: string[]
  pending: number
  toReschedule: { id: number; title: string }[]
  tomorrow: string[]
  score: number
}

export interface GeneralSettings {
  quietStart: string
  quietEnd: string
  /** Não perturbar: tudo vira alerta visual discreto. */
  dnd: boolean
  shift: {
    enabled: boolean
    /** Um dia de trabalho conhecido (AAAA-MM-DD) a partir do qual o ciclo é calculado. */
    anchorDate: string | null
    workDays: number
    offDays: number
  }
  /** Constância no Instagram: dias da semana de postagem (0=domingo) e horário do lembrete. */
  content: { days: number[]; remindAt: string }
  /** Meta de horas de estudo por semana. */
  study: { weeklyHours: number }
  /** Aviso de desacelerar antes de dormir (HH:MM). */
  sleep: { enabled: boolean; windDown: string }
  /** Revisão semanal automática: dia (0=domingo) e horário. */
  weekly: { enabled: boolean; day: number; time: string }
}

// ---------------------------------------------------------------- Fase 7: bem-estar e hábitos

export interface Checkin {
  id: number
  date: string
  time: string
  /** 1 (sem energia) a 5 (muita energia). */
  energy: number
  /** 1 (mal) a 5 (ótimo). */
  mood: number
  note: string
}

export interface CheckinSummary {
  /** Hora de perguntar: faz tempo desde o último check-in e é horário razoável. */
  due: boolean
  last: Checkin | null
  today: Checkin[]
  /** Blocos de 3 h com a média de energia (só os que têm dados). */
  blocks: { label: string; avgEnergy: number; n: number }[]
  /** Melhor bloco (precisa de pelo menos 6 check-ins no total). */
  best: { label: string; avgEnergy: number; n: number } | null
  suggestion: string
}

export interface StudyCard {
  id: number
  topic: string
  question: string
  answer: string
  /** Caixa de Leitner (0 a 4): quanto maior, mais espaçada a próxima revisão. */
  box: number
  nextReview: string
}

export interface StudyView {
  due: StudyCard[]
  dueCount: number
  total: number
  weeklyHours: { goal: number; done: number }
  topics: { topic: string; cards: number }[]
}

export interface TrainingEntry {
  weekday: number
  title: string
  time: string
}

export type VaultStatus = 'guardada' | 'executar' | 'adiada' | 'descartada'
export interface VaultItem {
  id: number
  title: string
  notes: string
  kind: 'ideia' | 'projeto'
  status: VaultStatus
  createdAt: string
}

export interface WellbeingSummary {
  routineStreak: number
  /** Dias dos últimos 7 em que pelo menos um checklist de âncora foi concluído por inteiro. */
  routineDays7: number
  tasksDoneToday: number
  tasksDoneWeek: number
  /** 10 pontos por tarefa concluída hoje (recompensa leve, sem punição). */
  pointsToday: number
  evolutionStreak: number
  /** Mensagem encorajadora conforme a situação (nunca de cobrança). */
  message: string
}

export interface WeeklyReview {
  from: string
  to: string
  tasksDone: number
  pending: number
  toReschedule: number
  avgScore: number
  goodDays: number
  bestDay: { date: string; score: number } | null
  pages: number
  avgSleep: number | null
  studyHours: number
  avgEnergy: number | null
  routineDays: number
  postsPosted: number
  highlights: string[]
  nextWeek: string[]
}

// ---------------------------------------------------------------- Pedidos e conteúdo (negócio 3D, versão enxuta)

/** Categoria das tarefas que são pedidos de clientes (só lembrar prazos; finanças ficam em outro app). */
export const ORDER_CATEGORY = 'pedido'

export const CONTENT_STEPS = ['roteiro', 'gravacao', 'edicao', 'legenda', 'postado'] as const
export type ContentStep = (typeof CONTENT_STEPS)[number]
export const CONTENT_KINDS = ['reel', 'post', 'story'] as const
export type ContentKind = (typeof CONTENT_KINDS)[number]

export interface ContentPost {
  id: number
  title: string
  kind: ContentKind
  /** Produto ao qual a ideia se refere (ex.: "chaveiro de pet"). */
  product: string
  notes: string
  /** Dia planejado (AAAA-MM-DD). null = está no banco de ideias. */
  date: string | null
  /** Etapas da produção já concluídas. */
  steps: ContentStep[]
  posted: boolean
  createdAt: string
}

export interface ContentToday {
  date: string
  /** Hoje é um dia de postagem configurado. */
  postingDay: boolean
  /** Dia de postar e ainda não postou. */
  pending: boolean
  /** Já passou do horário do lembrete. */
  remindNow: boolean
  remindAt: string
  post: ContentPost | null
}
