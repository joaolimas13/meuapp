import { useState } from 'react'
import { ORDER_CATEGORY } from '../../../shared/types'
import { useLoad } from '../hooks/useLoad'
import { api } from '../lib/api'
import { addDaysStr, formatDue } from '../lib/format'
import { playCue } from '../lib/sound'
import { ErrorLine } from './ErrorLine'

/*
  Pedidos: só o necessário para NÃO ESQUECER prazos de entrega (finanças ficam em outro app).
  Cada pedido é uma tarefa com a categoria "pedido". O GAIA avisa às 09:00 do dia anterior
  e do dia da entrega, com a mesma insistência dos outros lembretes.
*/
export function PedidosTab({ version, today, onChanged }: { version: number; today: string; onChanged: () => void }) {
  const { data, error, reload } = useLoad(() => api.tasks('todo'), [version])
  const [client, setClient] = useState('')
  const [item, setItem] = useState('')
  const [due, setDue] = useState('')
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
  const add = () => {
    if (!client.trim() || !item.trim() || !due) return
    run(async () => {
      await api.createTask({ title: `Pedido · ${client.trim()} — ${item.trim()}`, dueAt: due, category: ORDER_CATEGORY, insistence: 'max', priority: 'high' })
      setClient('')
      setItem('')
      setDue('')
    })
  }

  const orders = (data ?? []).filter((t) => t.category === ORDER_CATEGORY).sort((a, b) => (a.dueAt ?? '9').localeCompare(b.dueAt ?? '9'))

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3 flex flex-wrap gap-2">
        <input className="hud-input w-36" placeholder="Cliente" value={client} onChange={(e) => setClient(e.target.value)} aria-label="Cliente" />
        <input className="hud-input flex-1" placeholder="O que foi pedido" value={item} onChange={(e) => setItem(e.target.value)} aria-label="Item do pedido" />
        <input type="date" className="hud-input" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Entrega" />
        <button type="button" className="hud-btn primary" disabled={!client.trim() || !item.trim() || !due} onClick={add}>Registrar</button>
      </div>
      <p className="mono mb-2 text-xs" style={{ color: 'var(--text-dim)' }}>O GAIA avisa às 09:00 do dia anterior e do dia da entrega.</p>
      <ErrorLine msg={err ?? error} />
      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1" data-testid="orders-list">
        {data && orders.length === 0 && <li style={{ color: 'var(--text-dim)' }}>Nenhum pedido em aberto.</li>}
        {orders.map((t) => {
          const late = !!t.dueAt && t.dueAt.slice(0, 10) < today
          return (
            <li key={t.id} className="flex items-start justify-between gap-2 border-b pb-2" style={{ borderColor: 'var(--line)' }}>
              <div>
                <div className="text-lg">{t.title.replace(/^Pedido · /, '')}</div>
                <div className="mono text-xs" style={{ color: late ? 'var(--amber)' : 'var(--text-dim)' }}>
                  {late ? 'Prazo passou. Remarcar com o cliente?' : `entrega ${formatDue(t.dueAt, today)}`}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button type="button" className="hud-btn primary" onClick={() => run(async () => { await api.completeTask(t.id); playCue('done') })}>Entregue</button>
                <button type="button" className="hud-btn" onClick={() => run(() => api.updateTask(t.id, { dueAt: addDaysStr(t.dueAt ? t.dueAt.slice(0, 10) : today, 1) }))}>+1 dia</button>
                <button type="button" className="hud-btn" onClick={() => run(() => api.deleteTask(t.id))} aria-label={`Apagar ${t.title}`}>×</button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
