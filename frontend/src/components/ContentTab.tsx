import { useState } from 'react'
import { CONTENT_KINDS, CONTENT_STEPS, type ContentPost, type ContentStep } from '../../../shared/types'
import { useLoad } from '../hooks/useLoad'
import { api } from '../lib/api'
import { addDaysStr, longDate } from '../lib/format'
import { playCue } from '../lib/sound'
import { ErrorLine } from './ErrorLine'

const STEP_LABEL: Record<ContentStep, string> = { roteiro: 'Roteiro', gravacao: 'Gravação', edicao: 'Edição', legenda: 'Legenda', postado: 'Postado' }
const DAY_LABEL = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const weekday = (d: string) => new Date(`${d}T12:00:00`).getDay()

/** Calendário de conteúdo (Instagram): próximos 14 dias, banco de ideias, checklist de produção e dias de postagem. */
export function ContentTab({ version, today, onChanged }: { version: number; today: string; onChanged: () => void }) {
  const list = useLoad(api.content, [version])
  const settings = useLoad(api.settings, [])
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState('reel')
  const [product, setProduct] = useState('')
  const [date, setDate] = useState('')
  const [open, setOpen] = useState<number | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const run = async (fn: () => Promise<unknown>) => {
    try {
      setErr(null)
      await fn()
      onChanged()
      list.reload()
    } catch (e) {
      setErr((e as Error).message)
    }
  }
  const days = settings.data?.content.days ?? []
  const saveDays = (next: number[]) => run(async () => settings.set(await api.saveSettings({ content: { days: next } })))

  const posts = list.data?.posts ?? []
  const ideas = list.data?.ideas ?? []
  const calendar = Array.from({ length: 14 }, (_, i) => addDaysStr(today, i))

  const PostRow = ({ p }: { p: ContentPost }) => (
    <li className="border-b pb-1" style={{ borderColor: 'var(--line)' }}>
      <div className="flex items-start justify-between gap-2">
        <button type="button" className="min-w-0 text-left" onClick={() => setOpen(open === p.id ? null : p.id)} aria-expanded={open === p.id}>
          <span style={{ textDecoration: p.posted ? 'line-through' : 'none', opacity: p.posted ? 0.55 : 1 }}>{p.title}</span>
          <span className="mono block text-xs" style={{ color: 'var(--text-dim)' }}>
            {p.kind}{p.product ? ` · ${p.product}` : ''} · {p.steps.length}/{CONTENT_STEPS.length} etapas
          </span>
        </button>
        <button type="button" className="hud-btn" onClick={() => run(() => api.deleteContent(p.id))} aria-label={`Apagar ${p.title}`}>×</button>
      </div>
      {open === p.id && (
        <div className="mt-1 space-y-1 pl-2">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {CONTENT_STEPS.map((s) => (
              <label key={s} className="flex items-center gap-1">
                <input type="checkbox" checked={p.steps.includes(s)} onChange={(e) => run(async () => { await api.contentStep(p.id, s, e.target.checked); if (s === 'postado' && e.target.checked) playCue('done') })} />
                {STEP_LABEL[s]}
              </label>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm">
            Dia: <input type="date" className="hud-input" value={p.date ?? ''} onChange={(e) => run(() => api.updateContent(p.id, { date: e.target.value || null }))} aria-label={`Dia de ${p.title}`} />
          </label>
        </div>
      )}
    </li>
  )

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1" data-testid="content-tab">
      <ErrorLine msg={err ?? list.error} />
      <section>
        <h3 className="hud-title mb-1">Dias de postagem</h3>
        <div className="flex flex-wrap gap-1">
          {DAY_LABEL.map((l, i) => (
            <button key={l} type="button" className={`hud-btn ${days.includes(i) ? 'primary' : ''}`} aria-pressed={days.includes(i)} onClick={() => saveDays(days.includes(i) ? days.filter((d) => d !== i) : [...days, i])}>{l}</button>
          ))}
          {settings.data && (
            <input type="time" className="hud-input ml-2" value={settings.data.content.remindAt} onChange={(e) => e.target.value && run(async () => settings.set(await api.saveSettings({ content: { remindAt: e.target.value } })))} aria-label="Horário do lembrete" />
          )}
        </div>
      </section>

      <section>
        <h3 className="hud-title mb-1">Nova ideia</h3>
        <div className="flex flex-wrap gap-2">
          <input className="hud-input flex-1" placeholder="Ideia (ex.: Reel mostrando a pintura do chaveiro)" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Ideia de conteúdo" />
          <input className="hud-input w-32" placeholder="Produto" value={product} onChange={(e) => setProduct(e.target.value)} aria-label="Produto" />
          <select className="hud-input" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Tipo">{CONTENT_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}</select>
          <input type="date" className="hud-input" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Dia planejado" />
          <button type="button" className="hud-btn primary" disabled={!title.trim()} onClick={() => run(async () => { await api.addContent({ title: title.trim(), kind, product: product.trim(), date: date || null }); setTitle(''); setProduct(''); setDate('') })}>Guardar</button>
        </div>
        <p className="mono mt-1 text-xs" style={{ color: 'var(--text-dim)' }}>Sem data = vai para o banco de ideias.</p>
      </section>

      <section>
        <h3 className="hud-title mb-1">Próximos 14 dias</h3>
        <ul className="space-y-2">
          {calendar.map((d) => {
            const day = posts.filter((p) => p.date === d)
            const postingDay = days.includes(weekday(d))
            if (day.length === 0 && !postingDay) return null
            return (
              <li key={d}>
                <div className="mono text-xs" style={{ color: postingDay ? 'var(--amber)' : 'var(--text-dim)' }}>
                  {longDate(d)}{d === today ? ' · hoje' : ''}{postingDay ? ' · dia de postar' : ''}
                </div>
                {day.length === 0 ? <div style={{ color: 'var(--text-dim)' }}>Sem conteúdo planejado. Escolha uma ideia abaixo.</div> : <ul className="space-y-1">{day.map((p) => <PostRow key={p.id} p={p} />)}</ul>}
              </li>
            )
          })}
        </ul>
      </section>

      <section>
        <h3 className="hud-title mb-1">Banco de ideias ({ideas.length})</h3>
        {ideas.length === 0 && <p style={{ color: 'var(--text-dim)' }}>Nenhuma ideia guardada.</p>}
        <ul className="space-y-1" data-testid="ideas-list">{ideas.map((p) => <PostRow key={p.id} p={p} />)}</ul>
      </section>
    </div>
  )
}
