import { useState } from 'react'
import { MEMORY_CATEGORIES, type Memory } from '../../../shared/types'
import { useLoad } from '../hooks/useLoad'
import { api } from '../lib/api'
import { ErrorLine } from './ErrorLine'

/** Memórias: buscar, filtrar, adicionar, editar, apagar e exportar. Controle total é seu. */
export function MemoriesTab({ version }: { version: number }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const { data, error, reload } = useLoad(() => api.memories(q.trim() || undefined, cat || undefined), [version, q, cat])
  const [text, setText] = useState('')
  const [newCat, setNewCat] = useState('notas')
  const [editing, setEditing] = useState<Memory | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const run = async (fn: () => Promise<unknown>) => {
    try {
      setErr(null)
      await fn()
      reload()
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-2 flex gap-2">
        <input className="hud-input flex-1" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar memórias" />
        <select className="hud-input" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Filtrar categoria">
          <option value="">todas</option>
          {MEMORY_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="mb-3 flex gap-2">
        <input className="hud-input flex-1" placeholder="Nova memória…" value={text} onChange={(e) => setText(e.target.value)} aria-label="Nova memória" />
        <select className="hud-input" value={newCat} onChange={(e) => setNewCat(e.target.value)} aria-label="Categoria">
          {MEMORY_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button type="button" className="hud-btn primary" disabled={!text.trim()} onClick={() => run(async () => { await api.createMemory({ text: text.trim(), category: newCat }); setText('') })}>Guardar</button>
      </div>
      <ErrorLine msg={err ?? error} />
      <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1" data-testid="memories-list">
        {data && data.length === 0 && <li style={{ color: 'var(--text-dim)' }}>Nenhuma memória encontrada.</li>}
        {data?.map((m) => (
          <li key={m.id} className="border-b pb-2" style={{ borderColor: 'var(--line)' }}>
            {editing?.id === m.id ? (
              <div className="flex gap-2">
                <input className="hud-input flex-1" value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} aria-label="Editar memória" />
                <button type="button" className="hud-btn primary" onClick={() => run(async () => { await api.updateMemory(m.id, { text: editing.text }); setEditing(null) })}>Salvar</button>
                <button type="button" className="hud-btn" onClick={() => setEditing(null)}>Cancelar</button>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-lg">{m.text}</div>
                  <div className="mono text-xs" style={{ color: 'var(--text-dim)' }}>{m.category}{m.importance >= 5 ? ' · fixada' : ''}</div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button type="button" className="hud-btn" onClick={() => run(() => api.updateMemory(m.id, { importance: m.importance >= 5 ? 3 : 5 }))}>{m.importance >= 5 ? 'Soltar' : 'Fixar'}</button>
                  <button type="button" className="hud-btn" onClick={() => setEditing(m)}>Editar</button>
                  <button type="button" className="hud-btn" onClick={() => run(() => api.deleteMemory(m.id))} aria-label={`Apagar memória ${m.id}`}>×</button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-2 flex gap-3 border-t pt-2" style={{ borderColor: 'var(--line)' }}>
        <a className="hud-btn" href="/api/memories/export?format=json" download="memorias.json">Exportar JSON</a>
        <a className="hud-btn" href="/api/memories/export?format=md" download="memorias.md">Exportar Markdown</a>
      </div>
    </div>
  )
}
