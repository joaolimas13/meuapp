import type { InboxItem, InboxSuggestion } from '../../../shared/types'
import { MEMORY_CATEGORIES } from '../../../shared/types'
import type { AIProvider } from '../ai'
import { addDays, isDue, norm, type LocalNow } from '../lib/time'

/*
  SUGESTÕES PARA A CAIXA DE ENTRADA
  ---------------------------------
  A captura rápida não pergunta nada. Depois, o GAIA sugere o que cada anotação
  é (tarefa ou memória) e você aprova com um toque. Duas camadas:
   1. Regras simples (heuristicSuggestion): sempre funcionam, sem internet.
   2. IA (aiSuggestions): melhora a sugestão quando a chave está configurada.
  Se a IA falhar ou responder algo estranho, ficam as regras: nunca trava.
*/

const TASK_WORDS =
  /\b(ligar|comprar|fazer|enviar|mandar|pagar|marcar|agendar|buscar|levar|imprimir|responder|gravar|postar|resolver|preciso|tenho que|devo|lembrar de|lembra de|ir ao|ir na|entregar|cobrar|revisar)\b/
const WEEKDAYS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']

/** Entende "hoje", "amanhã", dia da semana e horários como "10h", "10h30", "14:30". */
export function parseSimpleDue(text: string, now: LocalNow): string | null {
  const t = norm(text)
  let date: string | null = null
  if (/\bhoje\b/.test(t)) date = now.date
  else if (/\bdepois de amanha\b/.test(t)) date = addDays(now.date, 2)
  else if (/\bamanha\b/.test(t)) date = addDays(now.date, 1)
  else {
    const idx = WEEKDAYS.findIndex((d) => new RegExp(`\\b${d}(-feira)?\\b`).test(t))
    if (idx >= 0) {
      const todayIdx = new Date(`${now.date}T12:00:00Z`).getUTCDay()
      date = addDays(now.date, ((idx - todayIdx + 7) % 7) || 7)
    }
  }
  const m = /\b(\d{1,2})\s*(?:h|:)\s*(\d{2})?\b/.exec(t)
  if (m && Number(m[1]) < 24 && Number(m[2] ?? 0) < 60) {
    const time = `${m[1].padStart(2, '0')}:${m[2] ?? '00'}`
    return `${date ?? now.date}T${time}`
  }
  return date
}

const clean = (s: string) => {
  const t = s.trim().replace(/\s+/g, ' ')
  return (t.charAt(0).toUpperCase() + t.slice(1)).slice(0, 120)
}

export function heuristicSuggestion(item: InboxItem, now: LocalNow): InboxSuggestion {
  const t = norm(item.text)
  const dueAt = parseSimpleDue(item.text, now)
  const isTask = TASK_WORDS.test(t) || dueAt !== null
  return {
    id: item.id,
    kind: isTask ? 'task' : 'memory',
    title: clean(item.text),
    category: isTask ? '' : /\b(ideia|e se|projeto|criar|inventar)\b/.test(t) ? 'ideias' : 'notas',
    dueAt: isTask ? dueAt : null,
    source: 'heuristic',
  }
}

const SYSTEM = `Você classifica anotações rápidas de uma pessoa. Para cada anotação, decida se é uma "task" (algo a fazer) ou uma "memory" (fato, ideia ou informação para guardar). Responda APENAS com um array JSON, sem texto extra e sem markdown, no formato:
[{"id": 1, "kind": "task" | "memory", "title": "texto curto e claro", "category": "uma de: ${MEMORY_CATEGORIES.join(', ')} (só para memory; vazio para task)", "due_at": "AAAA-MM-DD ou AAAA-MM-DDTHH:MM, ou null"}]`

async function collect(provider: AIProvider, system: string, content: string): Promise<string> {
  let out = ''
  for await (const ev of provider.streamChat({ system, messages: [{ role: 'user', content }] })) {
    if (ev.type === 'text') out += ev.text
  }
  return out
}

/** Pede à IA para classificar. Devolve só as sugestões válidas, as demais ficam para as regras. */
export async function aiSuggestions(provider: AIProvider, items: InboxItem[], now: LocalNow): Promise<InboxSuggestion[]> {
  const prompt = `Hoje é ${now.date}, agora são ${now.time}.\nAnotações:\n${items.map((i) => `${i.id}: ${i.text}`).join('\n')}`
  const raw = await collect(provider, SYSTEM, prompt)
  const start = raw.indexOf('[')
  const end = raw.lastIndexOf(']')
  if (start < 0 || end < start) return []
  let arr: unknown
  try {
    arr = JSON.parse(raw.slice(start, end + 1))
  } catch {
    return []
  }
  if (!Array.isArray(arr)) return []
  const ids = new Set(items.map((i) => i.id))
  const out: InboxSuggestion[] = []
  for (const x of arr as Record<string, unknown>[]) {
    if (!x || typeof x.id !== 'number' || !ids.has(x.id)) continue
    if (x.kind !== 'task' && x.kind !== 'memory') continue
    if (typeof x.title !== 'string' || !x.title.trim()) continue
    const cat = typeof x.category === 'string' && (MEMORY_CATEGORIES as readonly string[]).includes(x.category) ? x.category : x.kind === 'memory' ? 'notas' : ''
    out.push({
      id: x.id,
      kind: x.kind,
      title: x.title.trim().slice(0, 120),
      category: x.kind === 'memory' ? cat : '',
      dueAt: x.kind === 'task' && isDue(x.due_at) ? x.due_at : null,
      source: 'ai',
    })
  }
  return out
}

export async function suggestAll(provider: AIProvider, items: InboxItem[], now: LocalNow): Promise<InboxSuggestion[]> {
  if (items.length === 0) return []
  let fromAi: InboxSuggestion[] = []
  if (provider.isConfigured() && provider.name !== 'mock') {
    try {
      fromAi = await aiSuggestions(provider, items, now)
    } catch {
      /* sem IA agora: seguem as regras */
    }
  }
  const byId = new Map(fromAi.map((s) => [s.id, s]))
  return items.map((i) => byId.get(i.id) ?? heuristicSuggestion(i, now))
}
