import { useCallback, useEffect, useRef, useState } from 'react'
import { clearHistory, getHistory, streamChat } from '../lib/api'

export interface ChatAction {
  ok: boolean
  text: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  /** Ações que o GAIA executou nesta resposta ("✔ Tarefa criada"). */
  actions?: ChatAction[]
}

/** idle = parado · thinking = esperando a 1ª palavra · streaming = resposta chegando */
export type ChatStatus = 'idle' | 'thinking' | 'streaming'

let localId = 0
const nextId = () => `local-${++localId}`

/**
 * Estado do chat: histórico, envio com streaming e erros.
 * `onChanged` é chamado quando o GAIA muda dados (cria tarefa etc.), para a tela atualizar.
 */
export function useChat(onChanged: () => void) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [status, setStatus] = useState<ChatStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const changedRef = useRef(onChanged)
  changedRef.current = onChanged

  // Carrega o histórico salvo ao abrir.
  useEffect(() => {
    getHistory()
      .then((h) => setMessages(h.map((m) => ({ id: `db-${m.id}`, role: m.role, content: m.content }))))
      .catch(() => {
        /* backend fora do ar: o status da IA na barra já avisa */
      })
    return () => abortRef.current?.abort()
  }, [])

  const send = useCallback(
    async (text: string) => {
      const message = text.trim()
      if (!message || status !== 'idle') return

      const assistantId = nextId()
      setError(null)
      setStatus('thinking')
      setMessages((m) => [
        ...m,
        { id: nextId(), role: 'user', content: message },
        { id: assistantId, role: 'assistant', content: '' },
      ])

      const abort = new AbortController()
      abortRef.current = abort
      const patch = (fn: (m: ChatMessage) => ChatMessage) =>
        setMessages((all) => all.map((x) => (x.id === assistantId ? fn(x) : x)))

      await streamChat(
        message,
        {
          onDelta: (delta) => {
            setStatus('streaming')
            patch((x) => ({ ...x, content: x.content + delta }))
          },
          onAction: (action) => {
            patch((x) => ({ ...x, actions: [...(x.actions ?? []), action] }))
            if (action.ok) changedRef.current() // a tela principal se atualiza na hora
          },
          onDone: () => setStatus('idle'),
          onError: (msg) => {
            setError(msg)
            setStatus('idle')
            // Remove o balão da IA se nada chegou (nem texto, nem ações).
            setMessages((m) => m.filter((x) => !(x.id === assistantId && x.content === '' && !x.actions?.length)))
          },
        },
        abort.signal,
      )
      setStatus('idle') // garante que nunca fica travado, mesmo se a conexão cair
    },
    [status],
  )

  const clear = useCallback(async () => {
    try {
      await clearHistory()
      setMessages([])
      setError(null)
    } catch {
      setError('Não consegui apagar o histórico agora.')
    }
  }, [])

  return { messages, status, error, send, clear }
}
