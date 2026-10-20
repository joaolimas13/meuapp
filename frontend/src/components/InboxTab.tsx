import { useState } from 'react'
import type { InboxSuggestion } from '../../../shared/types'
import { useLoad } from '../hooks/useLoad'
import { api } from '../lib/api'
import { ErrorLine } from './ErrorLine'

/** Caixa de entrada: captura instantânea (sem categoria, sem prazo) e organização depois. */
export function InboxTab({ version, onChanged }: { version: number; onChanged: () => void }) {
  const { data, error, reload } = useLoad(api.inbox, [version])
  const [text, setText] = useState('')
  const [sugs, setSugs] = useState<Record<number, InboxSuggestion>>({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const run = async (fn: () => Promise<unknown>) => {
    try {
      setErr(null)
      await fn()
      onChanged()
      reload()
    } catch (e) {
      setErr((e as Error).message)
    }
  }
  const capture = () => {
    const t = text.trim()
    if (!t) return
    setText('')
    run(() => api.addInbox(t))
  }
  const organize = async () => {
    setBusy(true)
    try {
      setErr(null)
      const list = await api.suggestInbox()
      setSugs(Object.fromEntries(list.map((s) => [s.id, s])))
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const accept = (id: number, kind: 'task' | 'memory') => {
    const s = sugs[id]
    run(() => api.acceptInbox(id, { kind, title: s?.title, category: s?.category, dueAt: kind === 'task' ? s?.dueAt : undefined }))
  }

  const items = data ?? []
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3 flex gap-2">
        <input autoFocus className="hud-input flex-1" placeholder="Despeje a ideia aqui… (Enter salva na hora)" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && capture()} aria-label="Captura rápida" />
        <button type="button" className="hud-btn primary" onClick={capture} disabled={!text.trim()}>Anotar</button>
      </div>
      <ErrorLine msg={err ?? error} />
      <div className="mb-2 flex items-center justify-between">
        <span className="mono text-xs" style={{ color: 'var(--text-dim)' }}>{items.length} para organizar</span>
        <button type="button" className="hud-btn" onClick={organize} disabled={busy || items.length === 0}>{busy ? 'Pensando…' : 'Organizar com o GAIA'}</button>
      </div>
      <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1" data-testid="inbox-list">
        {data && items.length === 0 && <li style={{ color: 'var(--text-dim)' }}>Caixa vazia. Mente leve.</li>}
        {items.map((i) => {
          const s = sugs[i.id]
          return (
            <li key={i.id} className="border-b pb-2" style={{ borderColor: 'var(--line)' }}>
              <div className="text-lg">{i.text}</div>
              {s && (
                <div className="mono text-xs" style={{ color: 'var(--cyan)' }}>
                  sugestão: {s.kind === 'task' ? 'tarefa' : 'memória'}{s.dueAt ? ` · ${s.dueAt.replace('T', ' ')}` : ''} · {s.category}
                </div>
              )}
              <div className="mt-1 flex flex-wrap gap-1">
                {s && <button type="button" className="hud-btn primary" onClick={() => accept(i.id, s.kind)}>Aprovar</button>}
                <button type="button" className="hud-btn" onClick={() => accept(i.id, 'task')}>Tarefa</button>
                <button type="button" className="hud-btn" onClick={() => accept(i.id, 'memory')}>Memória</button>
                <button type="button" className="hud-btn" onClick={() => run(() => api.discardInbox(i.id))}>Descartar</button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
