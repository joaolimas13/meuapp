import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import type { FocusSession, Task } from '../../../shared/types'
import { useLoad } from '../hooks/useLoad'
import { useNow } from '../hooks/useNow'
import { api } from '../lib/api'
import { CONFIG } from '../lib/config'
import { nextStep } from '../lib/format'
import { playCue, speak, unlockAudio } from '../lib/sound'
import { ErrorLine } from './ErrorLine'

const PRESETS = [
  { label: '25 / 5', minutes: 25, breakMinutes: 5 },
  { label: '50 / 10', minutes: 50, breakMinutes: 10 },
  { label: '15 / 3', minutes: 15, breakMinutes: 3 },
]

interface Props {
  tasks: Task[]
  /** Tarefa sugerida para começar (ex.: a prioridade atual). */
  initialTaskId: number | null
  version: number
  onChanged: () => void
  onClose: () => void
}

type Ending = null | 'switch' | 'interrupted'

/*
  MODO FOCO — uma coisa de cada vez. Tela limpa: só a tarefa atual, o próximo passo e o timer.
  Ao fim do bloco o GAIA pergunta: terminei / mais um bloco / trocar.
  Ao trocar ou interromper, guardamos "onde parei" + o próximo passo (a ponte).
*/
export function FocusMode({ tasks, initialTaskId, version, onChanged, onClose }: Props) {
  const { data, error, set } = useLoad(api.focus, [version])
  const session = data?.session ?? null
  const [err, setErr] = useState<string | null>(null)
  const [preset, setPreset] = useState(PRESETS[0])
  const [pick, setPick] = useState<number | null>(initialTaskId)
  const [custom, setCustom] = useState('')
  const [ending, setEnding] = useState<Ending>(null)
  const [note, setNote] = useState('')
  const [next, setNext] = useState('')

  const run = async (fn: () => Promise<unknown>) => {
    try {
      setErr(null)
      await fn()
    } catch (e) {
      setErr((e as Error).message)
    }
  }
  const start = (taskId: number | null, title?: string) =>
    run(async () => {
      unlockAudio()
      const v = await api.startFocus({ taskId, title, minutes: preset.minutes, breakMinutes: preset.breakMinutes })
      set(v)
      setEnding(null)
      onChanged()
    })
  const finish = (s: FocusSession, outcome: 'done' | 'continue' | 'switch' | 'interrupted', extra: { note?: string; nextStep?: string } = {}) =>
    run(async () => {
      const v = await api.finishFocus(s.id, { outcome, ...extra })
      set(v)
      setEnding(null)
      setNote('')
      setNext('')
      onChanged()
      if (outcome === 'done') playCue('done')
      if (outcome === 'continue') await start(s.taskId, s.taskId ? undefined : s.title)
      if (outcome === 'done' || outcome === 'switch' || outcome === 'interrupted') setPick(null)
    })

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6"
      style={{ background: 'radial-gradient(ellipse at 50% 40%, var(--bg-2) 0%, var(--bg) 80%)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-label="Modo foco"
    >
      <button type="button" className="hud-btn absolute right-5 top-5" onClick={onClose}>Sair do foco [F]</button>
      <div className="hud-title absolute left-6 top-6">Modo foco</div>
      <div className="w-full max-w-2xl text-center">
        <ErrorLine msg={err ?? error} />
        {session ? (
          <Running
            key={session.id}
            session={session}
            serverNow={data!.serverNow}
            task={tasks.find((t) => t.id === session.taskId) ?? null}
            ending={ending}
            note={note}
            next={next}
            setNote={setNote}
            setNext={setNext}
            setEnding={(e, suggestion) => { setEnding(e); setNext(suggestion) }}
            onFinish={(o, extra) => finish(session, o, extra)}
            onStepDone={(id) => run(async () => { await api.completeTask(id); playCue('confirm'); onChanged() })}
          />
        ) : (
          <div className="space-y-4">
            <h2 className="text-3xl font-semibold">O que vamos fazer agora?</h2>
            <p style={{ color: 'var(--text-dim)' }}>Uma coisa de cada vez, {CONFIG.userName}.</p>
            <ul className="space-y-2">
              {tasks.slice(0, 3).map((t) => (
                <li key={t.id}>
                  <button type="button" className={`hud-btn w-full text-left ${pick === t.id ? 'primary' : ''}`} style={{ fontSize: '.9rem', textTransform: 'none', letterSpacing: 0 }} onClick={() => { setPick(t.id); setCustom('') }}>
                    {t.title}
                  </button>
                </li>
              ))}
            </ul>
            <input className="hud-input w-full" placeholder="…ou escreva outra coisa" value={custom} onChange={(e) => { setCustom(e.target.value); setPick(null) }} aria-label="Outra coisa" />
            <div className="flex justify-center gap-2">
              {PRESETS.map((p) => (
                <button key={p.label} type="button" className={`hud-btn ${preset === p ? 'primary' : ''}`} onClick={() => setPreset(p)}>{p.label}</button>
              ))}
            </div>
            <div className="mono text-xs" style={{ color: 'var(--text-dim)' }}>foco / pausa (minutos)</div>
            <button type="button" className="hud-btn primary" style={{ fontSize: '.8rem', padding: '.6rem 1.4rem' }} disabled={!pick && !custom.trim()} onClick={() => start(pick, pick ? undefined : custom.trim())}>
              Começar
            </button>
          </div>
        )}
      </div>
    </motion.div>
  )
}

function fmt(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function Running(props: {
  session: FocusSession
  serverNow: string
  task: Task | null
  ending: Ending
  note: string
  next: string
  setNote: (v: string) => void
  setNext: (v: string) => void
  setEnding: (e: Ending, suggestion: string) => void
  onFinish: (o: 'done' | 'continue' | 'switch' | 'interrupted', extra?: { note?: string; nextStep?: string }) => void
  onStepDone: (id: number) => void
}) {
  const { session, task, ending } = props
  const now = useNow(1000)
  // O relógio do navegador pode divergir do servidor: usamos a diferença medida ao carregar.
  const offset = useRef(Date.parse(props.serverNow) - Date.now())
  const end = Date.parse(session.startedAt) + session.minutes * 60_000
  const remaining = end - (now.getTime() + offset.current)
  const over = remaining <= 0
  const step = task ? nextStep(task) : null

  const announced = useRef(false)
  useEffect(() => {
    if (over && !announced.current) {
      announced.current = true
      playCue('wake')
      setTimeout(() => speak(`Bloco concluído. Você terminou, quer continuar ou trocar?`), 700)
    }
  }, [over])

  const total = session.minutes * 60_000
  const frac = over ? 1 : 1 - remaining / total
  const R = 120
  const C = 2 * Math.PI * R
  const color = over ? 'var(--amber)' : remaining < 5 * 60_000 ? 'var(--amber)' : 'var(--cyan)'

  return (
    <div className="space-y-5">
      <div className="hud-title" style={{ color: 'var(--amber)' }}>{over ? 'Fim do bloco' : 'Agora'}</div>
      <h2 className="text-4xl font-semibold" data-testid="focus-title">{session.title}</h2>
      {step && (
        <div className="text-xl" style={{ color: 'var(--cyan)' }}>
          Passo atual: {step.title}{step.estMinutes ? ` (${step.estMinutes} min)` : ''}
        </div>
      )}
      <div className="relative mx-auto h-[17rem] w-[17rem]">
        <svg viewBox="0 0 280 280" className="h-full w-full -rotate-90">
          <circle cx="140" cy="140" r={R} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="8" />
          <circle cx="140" cy="140" r={R} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} style={{ filter: `drop-shadow(0 0 8px ${color})`, transition: 'stroke-dashoffset 1s linear' }} />
        </svg>
        <div className="absolute inset-0 grid place-items-center" style={{ fontFamily: 'var(--font-title)', fontSize: '3rem', textShadow: 'var(--glow)' }} data-testid="focus-timer">
          {fmt(remaining)}
        </div>
      </div>

      {ending ? (
        <div className="space-y-2 text-left">
          <div className="hud-title">{ending === 'switch' ? 'Trocar de tarefa' : 'Interromper'}: guardar onde parei</div>
          <input className="hud-input w-full" placeholder="Onde você parou? (opcional)" value={props.note} onChange={(e) => props.setNote(e.target.value)} aria-label="Onde parou" />
          <input className="hud-input w-full" placeholder="Qual era o próximo passo? (opcional)" value={props.next} onChange={(e) => props.setNext(e.target.value)} aria-label="Próximo passo" />
          <div className="flex gap-2">
            <button type="button" className="hud-btn primary" onClick={() => props.onFinish(ending, { note: props.note, nextStep: props.next })}>Guardar e sair do bloco</button>
            <button type="button" className="hud-btn" onClick={() => props.setEnding(null, '')}>Voltar</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap justify-center gap-2">
          {step && <button type="button" className="hud-btn" onClick={() => props.onStepDone(step.id)}>Passo feito</button>}
          <button type="button" className="hud-btn primary" onClick={() => props.onFinish('done')}>Terminei</button>
          {over && <button type="button" className="hud-btn" onClick={() => props.onFinish('continue')}>Mais um bloco</button>}
          <button type="button" className="hud-btn" onClick={() => props.setEnding('switch', step?.title ?? '')}>Trocar</button>
          {!over && <button type="button" className="hud-btn" onClick={() => props.setEnding('interrupted', step?.title ?? '')}>Preciso parar</button>}
        </div>
      )}
    </div>
  )
}
