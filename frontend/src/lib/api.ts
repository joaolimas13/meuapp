// Cliente da API do backend. Em desenvolvimento o Vite encaminha /api para a porta 8787.
import type {
  DevDay,
  InboxItem,
  InboxSuggestion,
  Memory,
  Task,
  TodayView,
} from '../../../shared/types'

export interface HistoryMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export interface Health {
  ok: boolean
  ai: { provider: string; model: string; configured: boolean }
}

const OFFLINE_MSG = 'Não consegui falar com o backend do GAIA. Ele está rodando?'

/** Chamada JSON genérica. Erros viram `Error` com a mensagem em português que o backend enviou. */
async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new Error(OFFLINE_MSG)
  }
  if (!res.ok) {
    let msg = `Erro ${res.status}`
    try {
      const b = await res.json()
      if (b?.error) msg = b.error
    } catch {
      /* sem corpo */
    }
    throw new Error(msg)
  }
  return (res.status === 204 ? undefined : await res.json()) as T
}

export const getHealth = (signal?: AbortSignal) =>
  fetch('/api/health', { signal }).then((r) => {
    if (!r.ok) throw new Error(`health ${r.status}`)
    return r.json() as Promise<Health>
  })

export const getHistory = async () => (await req<{ messages: HistoryMessage[] }>('GET', '/api/chat/history')).messages
export const clearHistory = () => req<void>('DELETE', '/api/chat/history')

export interface NewTaskBody {
  title: string
  dueAt?: string | null
  priority?: Task['priority']
  steps?: { title: string; minutes?: number }[]
}

export const api = {
  // tarefas
  today: () => req<TodayView>('GET', '/api/today'),
  tasks: (status: 'todo' | 'done') => req<{ tasks: Task[] }>('GET', `/api/tasks?status=${status}`).then((r) => r.tasks),
  createTask: (b: NewTaskBody) => req<Task>('POST', '/api/tasks', b),
  updateTask: (id: number, b: Partial<Pick<Task, 'title' | 'dueAt' | 'priority' | 'status'>>) =>
    req<Task>('PATCH', `/api/tasks/${id}`, b),
  completeTask: (id: number) => req<{ task: Task; parentDone: Task | null }>('POST', `/api/tasks/${id}/complete`),
  deleteTask: (id: number) => req<void>('DELETE', `/api/tasks/${id}`),

  // caixa de entrada
  inbox: () => req<{ items: InboxItem[] }>('GET', '/api/inbox').then((r) => r.items),
  addInbox: (text: string) => req<InboxItem>('POST', '/api/inbox', { text }),
  suggestInbox: () => req<{ suggestions: InboxSuggestion[] }>('POST', '/api/inbox/suggest').then((r) => r.suggestions),
  acceptInbox: (id: number, b: { kind: 'task' | 'memory'; title?: string; category?: string; dueAt?: string | null }) =>
    req<{ kind: string; id: number }>('POST', `/api/inbox/${id}/accept`, b),
  discardInbox: (id: number) => req<void>('POST', `/api/inbox/${id}/discard`),

  // memórias
  memories: (q?: string, category?: string) => {
    const p = new URLSearchParams()
    if (q) p.set('q', q)
    if (category) p.set('category', category)
    return req<{ memories: Memory[] }>('GET', `/api/memories?${p}`).then((r) => r.memories)
  },
  createMemory: (b: { text: string; category?: string; importance?: number }) => req<Memory>('POST', '/api/memories', b),
  updateMemory: (id: number, b: { text?: string; category?: string; importance?: number }) =>
    req<Memory>('PATCH', `/api/memories/${id}`, b),
  deleteMemory: (id: number) => req<void>('DELETE', `/api/memories/${id}`),

  // desenvolvimento pessoal
  devDay: (date?: string) => req<DevDay>('GET', `/api/dev/day${date ? `?date=${date}` : ''}`),
  saveDay: (date: string, patch: Record<string, unknown>) => req<DevDay>('PUT', `/api/dev/day/${date}`, patch),
  addGoal: (b: { title: string; kind: 'fixed' | 'daily'; date: string }) => req<DevDay>('POST', '/api/dev/goals', b),
  deleteGoal: (id: number) => req<DevDay>('DELETE', `/api/dev/goals/${id}`),
  checkGoal: (id: number, date: string, done: boolean) => req<DevDay>('PUT', `/api/dev/goals/${id}/check`, { date, done }),
}

export interface StreamHandlers {
  onDelta: (text: string) => void
  onAction: (action: { ok: boolean; text: string }) => void
  onDone: () => void
  onError: (message: string) => void
}

/**
 * Envia a mensagem e lê a resposta em streaming (SSE). O backend manda linhas
 * "data: {json}" com type = delta | action | done | error.
 */
export async function streamChat(message: string, h: StreamHandlers, signal?: AbortSignal) {
  let res: Response
  try {
    res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message }),
      signal,
    })
  } catch {
    if (!signal?.aborted) h.onError(OFFLINE_MSG)
    return
  }
  if (!res.ok || !res.body) {
    h.onError(res.status === 400 ? 'Mensagem inválida.' : OFFLINE_MSG)
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finished = false

  const handle = (line: string) => {
    if (!line.startsWith('data:')) return
    try {
      const ev = JSON.parse(line.slice(5)) as { type: string; text?: string; ok?: boolean; message?: string }
      if (ev.type === 'delta' && ev.text) h.onDelta(ev.text)
      else if (ev.type === 'action') h.onAction({ ok: !!ev.ok, text: ev.text ?? '' })
      else if (ev.type === 'done') (finished = true), h.onDone()
      else if (ev.type === 'error') (finished = true), h.onError(ev.message ?? 'Erro desconhecido.')
    } catch {
      /* linha incompleta: ignora */
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      lines.forEach(handle)
    }
    handle(buffer)
  } catch {
    if (!signal?.aborted && !finished) h.onError('A conexão com o GAIA foi interrompida.')
    return
  }
  // A conexão fechou sem "done" nem "error": avisa em vez de ficar travado.
  if (!finished && !signal?.aborted) h.onError('A conexão com o GAIA foi interrompida.')
}
