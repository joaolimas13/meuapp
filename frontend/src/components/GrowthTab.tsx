import { useState } from 'react'
import type { DevDay } from '../../../shared/types'
import { useLoad } from '../hooks/useLoad'
import { api } from '../lib/api'
import { addDaysStr, longDate } from '../lib/format'
import { ErrorLine } from './ErrorLine'

const PART_LABELS: Record<string, string> = { goals: 'Metas', sleep: 'Sono', exercise: 'Exercício', study: 'Estudo', reading: 'Leitura' }

/** Evolução pessoal: registro do dia, metas, pontuação e estatísticas. */
export function GrowthTab({ version, today, onChanged }: { version: number; today: string; onChanged: () => void }) {
  const [date, setDate] = useState(today)
  const { data: day, error, set } = useLoad(() => api.devDay(date), [date, version])
  const [goal, setGoal] = useState('')
  const [kind, setKind] = useState<'fixed' | 'daily'>('daily')
  const [err, setErr] = useState<string | null>(null)

  const act = async (fn: () => Promise<DevDay>) => {
    try {
      setErr(null)
      set(await fn())
      onChanged()
    } catch (e) {
      setErr((e as Error).message)
    }
  }
  const save = (patch: Record<string, unknown>) => act(() => api.saveDay(date, patch))

  if (!day) return <><ErrorLine msg={err ?? error} /><p style={{ color: 'var(--text-dim)' }}>Carregando…</p></>
  const { log, stats, score, targets } = day
  const num = (v: string) => (v === '' ? null : Number(v))

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1" data-testid="growth">
      <div className="flex items-center justify-between">
        <button type="button" className="hud-btn" onClick={() => setDate(addDaysStr(date, -1))} aria-label="Dia anterior">‹</button>
        <div className="text-center">
          <div className="text-lg">{longDate(date)}</div>
          <div><span style={{ fontFamily: 'var(--font-title)', fontSize: '1.8rem', textShadow: 'var(--glow)' }} data-testid="score">{score.total}</span> <span className="mono text-sm" style={{ color: 'var(--text-dim)' }}>/ 100</span></div>
        </div>
        <button type="button" className="hud-btn" disabled={date >= today} onClick={() => setDate(addDaysStr(date, 1))} aria-label="Próximo dia">›</button>
      </div>
      <ErrorLine msg={err ?? error} />

      <div className="mono grid grid-cols-5 gap-1 text-center text-xs">
        {Object.entries(score.parts).map(([k, v]) => (
          <div key={k}><div style={{ color: 'var(--cyan)' }}>{Math.round(v)}</div><div style={{ color: 'var(--text-dim)' }}>{PART_LABELS[k]}</div></div>
        ))}
      </div>

      <section className="space-y-2">
        <label className="flex items-center gap-2"><input type="checkbox" checked={log.exercised} onChange={(e) => save({ exercised: e.target.checked })} /> Fiz atividade física</label>
        {log.exercised && <input className="hud-input w-full" placeholder="Qual? (opcional)" defaultValue={log.exerciseNote} onBlur={(e) => save({ exerciseNote: e.target.value })} aria-label="Atividade" />}
        <label className="flex items-center gap-2"><input type="checkbox" checked={log.studied} onChange={(e) => save({ studied: e.target.checked })} /> Estudei</label>
        {log.studied && <input type="number" min={0} step={0.25} className="hud-input w-40" placeholder="horas" defaultValue={log.studyHours ?? ''} onBlur={(e) => save({ studyHours: num(e.target.value) })} aria-label="Horas de estudo" />}
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2">Páginas <input type="number" min={0} className="hud-input w-24" defaultValue={log.pages} key={`p${date}${log.pages}`} onBlur={(e) => save({ pages: Number(e.target.value) || 0 })} aria-label="Páginas lidas" /> <span className="mono text-xs" style={{ color: 'var(--text-dim)' }}>meta {targets.pages}</span></label>
          <label className="flex items-center gap-2">Sono (h) <input type="number" min={0} max={24} step={0.5} className="hud-input w-24" defaultValue={log.sleepHours ?? ''} key={`s${date}${log.sleepHours}`} onBlur={(e) => save({ sleepHours: num(e.target.value) })} aria-label="Horas dormidas" /> <span className="mono text-xs" style={{ color: 'var(--text-dim)' }}>meta {targets.sleepHours}</span></label>
        </div>
        <div className="flex items-center gap-2">
          Água: <span className="mono" data-testid="water">{log.waterL.toFixed(2)} L</span> <span className="mono text-xs" style={{ color: 'var(--text-dim)' }}>meta {targets.waterL} L</span>
          <button type="button" className="hud-btn" onClick={() => save({ waterL: Math.max(0, log.waterL - 0.25) })}>−250</button>
          <button type="button" className="hud-btn primary" onClick={() => save({ waterL: log.waterL + 0.25 })}>+250 ml</button>
        </div>
      </section>

      <section>
        <h3 className="hud-title mb-1">Metas do dia</h3>
        <ul className="space-y-1">
          {day.goals.map((g) => (
            <li key={`${g.id}-${g.title}`} className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={g.done} disabled={g.id === null} onChange={(e) => g.id !== null && act(() => api.checkGoal(g.id!, date, e.target.checked))} />
                <span style={{ opacity: g.done ? 0.6 : 1 }}>{g.title}</span>
                <span className="mono text-xs" style={{ color: 'var(--text-dim)' }}>{g.kind === 'fixed' ? 'fixa' : g.kind === 'auto' ? 'automática' : 'do dia'}</span>
              </label>
              {g.id !== null && <button type="button" className="hud-btn" onClick={() => act(() => api.deleteGoal(g.id!))} aria-label={`Apagar meta ${g.title}`}>×</button>}
            </li>
          ))}
        </ul>
        <div className="mt-2 flex gap-2">
          <input className="hud-input flex-1" placeholder="Nova meta…" value={goal} onChange={(e) => setGoal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && goal.trim() && (act(() => api.addGoal({ title: goal.trim(), kind, date })), setGoal(''))} aria-label="Nova meta" />
          <select className="hud-input" value={kind} onChange={(e) => setKind(e.target.value as 'fixed' | 'daily')} aria-label="Tipo de meta"><option value="daily">do dia</option><option value="fixed">fixa</option></select>
          <button type="button" className="hud-btn primary" disabled={!goal.trim()} onClick={() => { act(() => api.addGoal({ title: goal.trim(), kind, date })); setGoal('') }}>Adicionar</button>
        </div>
      </section>

      <section>
        <h3 className="hud-title mb-1">Estatísticas</h3>
        <div className="mono text-sm" style={{ color: 'var(--text-dim)' }}>
          Sequência: <span style={{ color: 'var(--text)' }}>{stats.streak} dia(s)</span> (bom dia = {stats.goodDayThreshold}+)<br />
          Nível {stats.level} · {stats.xpInLevel}/{stats.xpPerLevel} XP<br />
          Páginas lidas: <span style={{ color: 'var(--text)' }} data-testid="pages-total">{stats.pagesTotal}</span> no total · {stats.pagesMonth} no mês
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div className="h-full" style={{ width: `${(stats.xpInLevel / stats.xpPerLevel) * 100}%`, background: 'var(--cyan)' }} />
        </div>
        <div className="mt-3 flex h-12 items-end gap-1" aria-label="Últimos 7 dias">
          {stats.last7.map((d) => (
            <div key={d.date} title={`${d.date}: ${d.score}`} className="flex-1" style={{ height: `${Math.max(4, d.score)}%`, background: d.score >= stats.goodDayThreshold ? 'var(--cyan)' : 'var(--line)' }} />
          ))}
        </div>
      </section>
    </div>
  )
}
