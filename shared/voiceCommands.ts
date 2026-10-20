// Interpretação dos comandos de voz (função pura: mesma lógica no navegador e nos testes).
// Regra: "capturar rápido" nunca pergunta nada. Tudo o que não é comando vai para o chat.

export type TabName = 'chat' | 'inbox' | 'tasks' | 'day' | 'memories' | 'growth' | 'routine' | 'orders' | 'content' | 'study' | 'vault'

export type VoiceCommand =
  | { type: 'wake' } // só disseram "Gaia": passa a ouvir o comando seguinte
  | { type: 'capture'; text: string }
  | { type: 'alert'; action: 'done' | 'snooze' | 'cancel' }
  | { type: 'where' }
  | { type: 'focus'; on: boolean }
  | { type: 'open'; tab: TabName }
  | { type: 'close' }
  | { type: 'chat'; text: string }

const strip = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.,;:!?]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

// O reconhecimento de voz escreve "Gaia" de formas diferentes.
const WAKE = /^(?:(?:oi|ei|ola|ok|e ai|hey)\s+)?(?:gaia|gaya|gaja|gaea|gaiah|guaia|gaiha)\b\s*/

/** Remove a palavra de ativação. `null` se a frase não começa com ela. */
export function stripWake(raw: string): string | null {
  const m = WAKE.exec(strip(raw))
  return m ? strip(raw).slice(m[0].length) : null
}

const CAPTURE = /^(?:anota(?:r)?|anote|guarda(?:r)?|guarde|lembra(?:r)?(?: que| de| me)?|lembre(?: que| de| me)?|salva(?:r)?|salve|registra(?:r)?|registre|nao esquecer(?: de)?)\b(?: ai| isso| ai pra mim| pra mim)?\s*(?:que |de )?/

const TABS: [RegExp, TabName][] = [
  [/\b(chat|conversa)\b/, 'chat'],
  [/\b(caixa|entrada|inbox)\b/, 'inbox'],
  [/\b(tarefas?)\b/, 'tasks'],
  [/\b(dia|plano|agenda)\b/, 'day'],
  [/\b(memorias?)\b/, 'memories'],
  [/\b(evolucao|metas|progresso)\b/, 'growth'],
  [/\b(rotina|ancoras?|configuracoes)\b/, 'routine'],
  [/\b(pedidos?|encomendas?)\b/, 'orders'],
  [/\b(conteudo|instagram|reels?|calendario)\b/, 'content'],
  [/\b(estudos?|revisao|revisoes|flashcards?)\b/, 'study'],
  [/\b(cofre|ideias)\b/, 'vault'],
]

/**
 * Interpreta uma frase. `wakeRequired`: exige "Gaia" no início (escuta passiva).
 * `bare`: aceita "feito/adiar/cancelar" soltos (quando há um alerta na tela).
 * Devolve `null` se a frase deve ser ignorada (não era para o GAIA).
 */
export function parseVoice(raw: string, opts: { wakeRequired: boolean; bare?: boolean }): VoiceCommand | null {
  const rest = stripWake(raw)
  let text: string
  if (rest !== null) {
    if (rest === '') return { type: 'wake' }
    text = rest
  } else if (opts.wakeRequired) {
    // Sem a palavra de ativação só valem as respostas curtas a um alerta.
    text = strip(raw)
    if (!opts.bare || !alertAction(text)) return null
  } else {
    text = strip(raw)
  }
  if (!text) return null

  const cap = CAPTURE.exec(text)
  if (cap) {
    // Mantém a frase original (com acentos) depois do verbo: recorta pelo mesmo tamanho de palavras.
    const original = originalTail(raw, text, cap[0])
    return original ? { type: 'capture', text: original } : { type: 'chat', text: raw.trim() }
  }

  const a = alertAction(text)
  if (a) return { type: 'alert', action: a }
  if (/^(onde eu parei|onde parei|o que eu estava fazendo|retomar)\b/.test(text)) return { type: 'where' }
  if (/^(sair do foco|parar o foco|encerrar o foco|fim do foco)\b/.test(text)) return { type: 'focus', on: false }
  if (/^(modo foco|foco|comecar (o )?foco|iniciar (o )?foco|entrar em foco|vamos focar)\b/.test(text)) return { type: 'focus', on: true }
  if (/^(fechar|fecha|esconder)\b/.test(text)) return { type: 'close' }
  const open = /^(abrir|abre|mostrar|mostra|ir para|ver)\b/.exec(text)
  if (open) {
    const hit = TABS.find(([re]) => re.test(text.slice(open[0].length)))
    if (hit) return { type: 'open', tab: hit[1] }
  }
  return { type: 'chat', text: raw.trim() }
}

function alertAction(t: string): 'done' | 'snooze' | 'cancel' | null {
  if (/^(feito|pronto|concluido|concluida|terminei|ja fiz|fiz)$/.test(t)) return 'done'
  if (/^(adiar|adia|adie|soneca|depois|mais tarde|daqui a pouco|me lembra depois)$/.test(t)) return 'snooze'
  if (/^(cancelar|cancela|cancele|esquece|deixa pra la)$/.test(t)) return 'cancel'
  return null
}

/** Texto original (com acentos e maiúsculas) que vem depois do verbo de captura. */
function originalTail(raw: string, normalized: string, verbPart: string): string {
  const afterNorm = normalized.slice(verbPart.length).trim()
  if (!afterNorm) return ''
  const words = raw.trim().split(/\s+/)
  const n = afterNorm.split(' ').length
  return words.slice(-n).join(' ').replace(/^[,.;:!?\s]+/, '').trim()
}
