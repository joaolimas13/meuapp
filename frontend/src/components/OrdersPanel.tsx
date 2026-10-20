import type { Task } from '../../../shared/types'
import { formatDue } from '../lib/format'
import { Panel } from './Panel'

/** Resumo enxuto dos próximos pedidos (só prazos de entrega). */
export function OrdersPanel({ orders, today, onOpen, delay }: { orders: Task[]; today: string; onOpen: () => void; delay?: number }) {
  const top = [...orders].sort((a, b) => (a.dueAt ?? '9').localeCompare(b.dueAt ?? '9')).slice(0, 3)
  return (
    <Panel title="Pedidos" delay={delay}>
      {top.length === 0 ? (
        <p style={{ color: 'var(--text-dim)' }}>Nenhum pedido em aberto.</p>
      ) : (
        <ul className="space-y-1.5">
          {top.map((t) => (
            <li key={t.id} className="flex justify-between gap-3">
              <span>{t.title.replace(/^Pedido · /, '')}</span>
              <span className="mono shrink-0 text-sm" style={{ color: t.dueAt && t.dueAt.slice(0, 10) < today ? 'var(--amber)' : 'var(--text-dim)' }}>{formatDue(t.dueAt, today)}</span>
            </li>
          ))}
        </ul>
      )}
      {orders.length > 3 && <p className="mono mt-1 text-xs" style={{ color: 'var(--text-dim)' }}>+{orders.length - 3} na aba Pedidos</p>}
      <button type="button" className="hud-btn mt-2" onClick={onOpen}>Abrir pedidos</button>
    </Panel>
  )
}
