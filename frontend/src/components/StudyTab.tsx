import { useState } from 'react'
import { useLoad } from '../hooks/useLoad'
import { api } from '../lib/api'
import { playCue } from '../lib/sound'
import { ErrorLine } from './ErrorLine'

/** Estudos: revisão espaçada (um cartão por vez), novos cartões e meta de horas da semana. */
export function StudyTab({ version, onChanged }: { version: number; onChanged: () => void }) {
  const { data, error, set } = useLoad(api.study, [version])
  const [shown, setShown] = useState(false)
  const [topic, setTopic] = useState('')
  const [q, setQ] = useState('')
  const [a, setA] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const act = async (fn: () => Promise<unknown>) => {
    try {
      setErr(null)
      await fn()
      onChanged()
    } catch (e) {
      setErr((e as Error).message)
    }
  }
  const card = data?.due[0]
  const rate = (result: 'wrong' | 'hard' | 'right') =>
    act(async () => {
      set(await api.reviewCard(card!.id, result))
      setShown(false)
      if (result === 'right') playCue('confirm')
    })
  const pct = data ? Math.min(100, Math.round((data.weeklyHours.done / Math.max(1, data.weeklyHours.goal)) * 100)) : 0

  return (
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1" data-testid="study-tab">
      <ErrorLine msg={err ?? error} />
      <section>
        <h3 className="hud-title mb-1">Revisão de hoje{data ? ` · ${data.dueCount} cartão(ões)` : ''}</h3>
        {!data ? (
          <p style={{ color: 'var(--text-dim)' }}>Carregando…</p>
        ) : !card ? (
          <p style={{ color: 'var(--text-dim)' }}>{data.total === 0 ? 'Nenhum cartão ainda. Crie abaixo ou peça ao GAIA: “crie cartões sobre o que estudei”.' : 'Revisão em dia. Bom trabalho.'}</p>
        ) : (
          <div className="space-y-3" data-testid="study-card">
            {card.topic && <div className="mono text-xs" style={{ color: 'var(--text-dim)' }}>{card.topic}</div>}
            <div className="text-xl">{card.question}</div>
            {shown ? (
              <>
                <div className="border-l-2 pl-3" style={{ borderColor: 'var(--cyan)' }}>{card.answer}</div>
                <div className="flex gap-2">
                  <button type="button" className="hud-btn" onClick={() => rate('wrong')}>Errei</button>
                  <button type="button" className="hud-btn" onClick={() => rate('hard')}>Difícil</button>
                  <button type="button" className="hud-btn primary" onClick={() => rate('right')}>Acertei</button>
                </div>
              </>
            ) : (
              <button type="button" className="hud-btn primary" onClick={() => setShown(true)}>Mostrar resposta</button>
            )}
          </div>
        )}
      </section>

      <section>
        <h3 className="hud-title mb-1">Meta da semana</h3>
        {data && (
          <>
            <div className="mono text-sm">{data.weeklyHours.done} h de {data.weeklyHours.goal} h (últimos 7 dias)</div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div className="h-full" style={{ width: `${pct}%`, background: 'var(--cyan)' }} />
            </div>
          </>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="hud-title">Novo cartão</h3>
        <input className="hud-input w-full" placeholder="Assunto (opcional)" value={topic} onChange={(e) => setTopic(e.target.value)} aria-label="Assunto" />
        <input className="hud-input w-full" placeholder="Pergunta" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Pergunta" />
        <input className="hud-input w-full" placeholder="Resposta" value={a} onChange={(e) => setA(e.target.value)} aria-label="Resposta" />
        <button type="button" className="hud-btn primary" disabled={!q.trim() || !a.trim()} onClick={() => act(async () => { set(await api.addCard({ topic: topic.trim(), question: q.trim(), answer: a.trim() })); setQ(''); setA('') })}>Adicionar cartão</button>
        {data && data.topics.length > 0 && (
          <p className="mono text-xs" style={{ color: 'var(--text-dim)' }}>{data.total} cartões: {data.topics.map((t) => `${t.topic || 'sem assunto'} (${t.cards})`).join(', ')}</p>
        )}
      </section>
    </div>
  )
}
