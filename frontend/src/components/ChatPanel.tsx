import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { ChatMessage, ChatStatus } from '../hooks/useChat'

interface Props {
  messages: ChatMessage[]
  status: ChatStatus
  error: string | null
  onSend: (text: string) => void
  onClear: () => void
}

/** Conteúdo do chat (terminal/HUD). A resposta aparece aos poucos; ações viram "✔ ..." */
export function ChatPanel({ messages, status, error, onSend, onClear }: Props) {
  const [draft, setDraft] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const busy = status !== 'idle'

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, error])

  const submit = () => {
    if (!draft.trim() || busy) return
    onSend(draft)
    setDraft('')
  }
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={listRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1" data-testid="chat-list">
        {messages.length === 0 && <p style={{ color: 'var(--text-dim)' }}>Pronto quando você estiver. Escreva abaixo.</p>}
        {messages.map((m, i) => {
          const streaming = i === messages.length - 1 && m.role === 'assistant' && busy
          return (
            <div key={m.id}>
              <div className="mono text-xs" style={{ color: m.role === 'user' ? 'var(--amber)' : 'var(--cyan)' }}>
                {m.role === 'user' ? 'VOCÊ ›' : 'GAIA ›'}
              </div>
              {m.actions?.map((a, k) => (
                <div key={k} className="mono text-sm" style={{ color: a.ok ? 'var(--cyan)' : 'var(--amber)' }}>
                  {a.ok ? '✔' : '✖'} {a.text}
                </div>
              ))}
              <div className="whitespace-pre-wrap text-lg leading-snug">
                {m.content}
                {streaming && m.content === '' && !m.actions?.length && <span className="pulse" style={{ color: 'var(--text-dim)' }}>processando…</span>}
                {streaming && m.content !== '' && <span className="pulse" style={{ color: 'var(--cyan)' }}>▍</span>}
              </div>
            </div>
          )
        })}
        {error && <div className="mono text-sm" style={{ color: 'var(--amber)' }} role="alert">! {error}</div>}
      </div>

      <div className="mt-3 flex gap-2 border-t pt-3" style={{ borderColor: 'var(--line)' }}>
        <textarea
          autoFocus
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          placeholder="Fale com o GAIA…  (Enter envia)"
          className="hud-input flex-1 resize-none"
          aria-label="Mensagem para o GAIA"
        />
        <div className="flex flex-col gap-1">
          <button type="button" onClick={submit} disabled={busy || !draft.trim()} className="hud-btn primary">Enviar</button>
          <button type="button" onClick={onClear} disabled={busy || messages.length === 0} className="hud-btn">Limpar</button>
        </div>
      </div>
    </div>
  )
}
