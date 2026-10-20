import type { Task } from '../../../shared/types'
import { nextStep } from '../lib/format'
import { Panel } from './Panel'

/*
  "Meu Dia": no máximo 3 prioridades (redução de sobrecarga).
  A primeira vira a "prioridade atual". Se a tarefa tem passos, mostra só o PRÓXIMO passo.
*/
export function MyDayPanel({ items, onComplete, onFocus, delay }: { items: Task[]; onComplete: (id: number) => void; onFocus: (id: number) => void; delay?: number }) {
  const top3 = items.slice(0, 3)
  return (
    <Panel title="Meu dia" delay={delay}>
      {top3.length === 0 && <p style={{ color: 'var(--text-dim)' }}>Nada pendente por aqui. Peça ao GAIA ou use a Caixa de entrada.</p>}
      <ul className="space-y-3">
        {top3.map((t, i) => {
          const step = nextStep(t)
          const target = step ?? t // o que "Feito" conclui: o passo atual ou a tarefa
          return (
            <li key={t.id}>
              <button type="button" onClick={() => onComplete(target.id)} className="flex w-full items-start gap-3 text-left" aria-label={`Concluir: ${target.title}`}>
                <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center border text-xs" style={{ borderColor: 'var(--line)' }} />
                <span>
                  {i === 0 && <span className="hud-title block" style={{ color: 'var(--amber)' }}>Prioridade atual</span>}
                  <span className={i === 0 ? 'text-xl font-semibold' : 'text-lg'}>{t.title}</span>
                  {step && (
                    <span className="mono block text-xs" style={{ color: 'var(--cyan)' }}>
                      próximo passo: {step.title}{step.estMinutes ? ` (${step.estMinutes} min)` : ''}
                    </span>
                  )}
                </span>
              </button>
              {i === 0 && <button type="button" className="hud-btn mt-1 ml-8" onClick={() => onFocus(t.id)}>Focar nisso</button>}
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}
