import type { DevDay } from '../../../shared/types'
import { Panel } from './Panel'

/** Resumo do dia de evolução: pontos de hoje, sequência e nível. Toque abre a aba Evolução. */
export function GrowthCard({ day, onOpen, delay }: { day: DevDay | null; onOpen: () => void; delay?: number }) {
  return (
    <Panel title="Evolução" delay={delay}>
      {!day ? (
        <p style={{ color: 'var(--text-dim)' }}>Carregando…</p>
      ) : (
        <button type="button" onClick={onOpen} className="block w-full text-left">
          <div className="flex items-baseline gap-2">
            <span style={{ fontFamily: 'var(--font-title)', fontSize: '2rem', textShadow: 'var(--glow)' }}>{day.score.total}</span>
            <span className="mono text-sm" style={{ color: 'var(--text-dim)' }}>/ 100 hoje</span>
          </div>
          <div className="mono mt-1 text-sm" style={{ color: 'var(--text-dim)' }}>
            sequência {day.stats.streak} dia(s) · nível {day.stats.level} · {day.stats.pagesTotal} págs. lidas
          </div>
        </button>
      )}
    </Panel>
  )
}
