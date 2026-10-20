import { useNow } from '../hooks/useNow'
import { CONFIG } from '../lib/config'

/** Saudação contextual com resumo rápido do dia. */
export function Greeting({ priorities, nextTime }: { priorities: number; nextTime: string | null }) {
  const now = useNow(60_000)
  const h = now.getHours()
  const hello = h >= 5 && h < 12 ? 'Bom dia' : h >= 12 && h < 18 ? 'Boa tarde' : 'Boa noite'
  const p = priorities === 0 ? 'Nenhuma prioridade pendente' : priorities === 1 ? '1 prioridade' : `${priorities} prioridades`
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-title)', fontSize: '1.5rem', textShadow: 'var(--glow)' }}>
        {hello}, {CONFIG.userName}.
      </div>
      <p className="mt-1 text-lg" style={{ color: 'var(--text-dim)' }}>
        {p} hoje.{nextTime ? ` Próximo compromisso às ${nextTime}.` : ' Sem compromissos com horário pela frente.'}
      </p>
    </div>
  )
}
