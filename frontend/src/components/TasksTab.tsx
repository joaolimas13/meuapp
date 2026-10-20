import { useState } from 'react'
import type { Task } from '../../../shared/types'
import { useLoad } from '../hooks/useLoad'
import { api } from '../lib/api'
import { formatDue } from '../lib/format'
import { ErrorLine } from './ErrorLine'

interface Props {
  version: number
  today: string
  onChanged: () => void
  askGaia: (text: string) => void
}

/** Lista de tarefas pendentes, com passos e "Quebrar em passos" (pede ao GAIA). */
export function TasksTab({ version, today, onChanged, askGaia }: Props) {
  const { data, error, reload } = useLoad(() => api.tasks('todo'), [version])
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [open, setOpen] = useState<number | null>(null)
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
    const t = title.trim()
    if (!t) return
    run(async () => {
      await api.createTask({ title: t, dueAt: due || null })
      setTitle('')
      setDue('')
    })
  }

  const tasks = (data ?? []).filter((t) => t.parentId === null)
  const overdue = (t: Task) => !!t.dueAt && t.dueAt.slice(0, 10) < today
  const groups: [string, Task[]][] = [
    ['Para remarcar', tasks.filter(overdue)],
    ['Hoje', tasks.filter((t) => !overdue(t) && t.dueAt?.slice(0, 10) === today)],
    ['Próximas', tasks.filter((t) => t.dueAt && t.dueAt.slice(0, 10) > today)],
    ['Sem data', tasks.filter((t) => !t.dueAt)],
  ]

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3 flex flex-wrap gap-2">
        <input className="hud-input flex-1" placeholder="Nova tarefa…" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} aria-label="Nova tarefa" />
        <input type="datetime-local" className="hud-input" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Prazo" />
        <button type="button" className="hud-btn primary" onClick={add} disabled={!title.trim()}>Adicionar</button>
      </div>
      <ErrorLine msg={err ?? error} />
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1" data-testid="tasks-list">
        {data && tasks.length === 0 && <p style={{ color: 'var(--text-dim)' }}>Nenhuma tarefa pendente.</p>}
        {groups.map(([name, list]) =>
          list.length === 0 ? null : (
            <section key={name}>
              <h3 className="hud-title mb-1" style={name === 'Para remarcar' ? { color: 'var(--amber)' } : undefined}>{name}</h3>
              <ul className="space-y-2">
                {list.map((t) => {
                  const done = t.steps.filter((s) => s.status === 'done').length
                  const next = t.steps.find((s) => s.status === 'todo')
                  return (
                    <li key={t.id} className="border-b pb-2" style={{ borderColor: 'var(--line)' }}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-lg">{t.title}</div>
                          <div className="mono text-xs" style={{ color: 'var(--text-dim)' }}>
                            {[t.dueAt ? formatDue(t.dueAt, today) : '', t.priority === 'high' ? 'prioridade alta' : '', t.steps.length ? `${done}/${t.steps.length} passos` : ''].filter(Boolean).join(' · ')}
                          </div>
                          {next && <div className="mono text-xs" style={{ color: 'var(--cyan)' }}>próximo: {next.title}</div>}
                        </div>
                        <div className="flex shrink-0 flex-wrap justify-end gap-1">
                          {t.steps.length > 0 && <button type="button" className="hud-btn" onClick={() => setOpen(open === t.id ? null : t.id)}>Passos</button>}
                          {t.steps.length === 0 && <button type="button" className="hud-btn" onClick={() => askGaia(`Quebre a tarefa "${t.title}" (id ${t.id}) em passos pequenos de 5 a 15 minutos.`)}>Quebrar</button>}
                          <button type="button" className="hud-btn primary" onClick={() => run(() => api.completeTask(t.id))}>Feito</button>
                          <button type="button" className="hud-btn" onClick={() => run(() => api.deleteTask(t.id))} aria-label={`Apagar ${t.title}`}>×</button>
                        </div>
                      </div>
                      {open === t.id && (
                        <ul className="mt-2 space-y-1 pl-4">
                          {t.steps.map((s) => (
                            <li key={s.id} className="flex items-center justify-between gap-2">
                              <span style={{ textDecoration: s.status === 'done' ? 'line-through' : 'none', opacity: s.status === 'done' ? 0.5 : 1 }}>
                                {s.title}{s.estMinutes ? ` · ${s.estMinutes} min` : ''}
                              </span>
                              {s.status === 'todo' && <button type="button" className="hud-btn" onClick={() => run(() => api.completeTask(s.id))}>Feito</button>}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          ),
        )}
      </div>
    </div>
  )
}
