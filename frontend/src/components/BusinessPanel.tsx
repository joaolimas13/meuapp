import type { BusinessSummary } from '../../../shared/types'
import { Panel } from './Panel'

/** Resumo enxuto do negócio 3D. Ainda é EXEMPLO: a versão real chega na Fase 6. */
export function BusinessPanel({ data, delay }: { data: BusinessSummary; delay?: number }) {
  const rows: [string, string][] = [
    ['Pedidos em andamento', String(data.inProgress)],
    ['Próxima entrega', data.nextDelivery],
    ['Filamento baixo', data.lowFilament],
    ['Pagamentos pendentes', String(data.pendingPayments)],
  ]
  return (
    <Panel title="Negócio 3D · exemplo" delay={delay}>
      <dl className="space-y-1.5" style={{ opacity: 0.7 }}>
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt style={{ color: 'var(--text-dim)' }}>{k}</dt>
            <dd className="mono">{v}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  )
}
