import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import type { OrbState } from '../../shared/types'
import { BusinessPanel } from './components/BusinessPanel'
import { ChatPanel } from './components/ChatPanel'
import { AlertBanner } from './components/AlertBanner'
import { DayTab } from './components/DayTab'
import { Drawer, type TabId } from './components/Drawer'
import { FocusMode } from './components/FocusMode'
import { ResumeCard } from './components/ResumeCard'
import { RoutineTab } from './components/RoutineTab'
import { GrowthCard } from './components/GrowthCard'
import { GrowthTab } from './components/GrowthTab'
import { InboxTab } from './components/InboxTab'
import { MemoriesTab } from './components/MemoriesTab'
import { TasksTab } from './components/TasksTab'
import { Clock } from './components/Clock'
import { Greeting } from './components/Greeting'
import { MyDayPanel } from './components/MyDayPanel'
import { NextEventBar } from './components/NextEventBar'
import { Orb } from './components/Orb'
import { RemindersPanel } from './components/RemindersPanel'
import { StatusBar } from './components/StatusBar'
import { useAiStatus } from './hooks/useAiStatus'
import { useAmbient } from './hooks/useAmbient'
import { useAlerts } from './hooks/useAlerts'
import { useChat } from './hooks/useChat'
import { useLoad } from './hooks/useLoad'
import { useToday } from './hooks/useToday'
import { api } from './lib/api'
import { useNightMode } from './hooks/useNightMode'
import { CONFIG } from './lib/config'
import { BUSINESS } from './lib/sampleData'
import { playCue, unlockAudio } from './lib/sound'

// Teclas de teste do orbe. Com o chat aberto, o estado real (pensando/falando) tem prioridade.
const TAB_KEYS: Record<string, TabId> = { c: 'chat', i: 'inbox', t: 'tasks', d: 'day', m: 'memories', e: 'growth', r: 'routine' }

const STATE_KEYS: Record<string, OrbState> = {
  '1': 'idle',
  '2': 'listening',
  '3': 'thinking',
  '4': 'speaking',
  '5': 'alert',
}

/** True quando o foco está num campo de texto (não queremos atalhos enquanto você digita). */
function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null
  return !!el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.isContentEditable)
}

export default function App() {
  const [manualOrb, setManualOrb] = useState<OrbState>('idle')
  const [lite, setLite] = useState(false)
  const [tab, setTab] = useState<TabId | null>(null) // null = gaveta fechada
  const [version, setVersion] = useState(0) // sobe quando algo muda (recarrega os painéis)
  const bump = useCallback(() => setVersion((v) => v + 1), [])
  const { ambient, wakeKey, sleep } = useAmbient(CONFIG.ambientAfterSec * 1000)
  const night = useNightMode()
  const chat = useChat(bump)
  const alerts = useAlerts(version)
  const bridge = useLoad(api.bridge, [version])
  const focusNow = useLoad(api.focus, [version])
  const [focusOpen, setFocusOpen] = useState(false)
  const [focusTask, setFocusTask] = useState<number | null>(null)
  const openFocus = (taskId: number | null = null) => { unlockAudio(); setFocusTask(taskId); setFocusOpen(true) }
  const today = useToday(version)
  const growth = useLoad(() => api.devDay(), [version])
  const inbox = useLoad(api.inbox, [version])
  const todayStr = today.data?.date ?? new Date().toLocaleDateString('sv-SE')

  const mutate = (fn: () => Promise<unknown>) => fn().then(bump).catch(() => bump())
  const complete = (id: number) => { playCue('done'); return mutate(() => api.completeTask(id)) }
  /** Abre o chat e manda uma mensagem pelo GAIA (ex.: "Quebrar em passos"). */
  const askGaia = (text: string) => {
    setTab('chat')
    chat.send(text)
  }
  const ai = useAiStatus()

  const hotAlert = (alerts.data?.alerts ?? []).some((a) => a.level >= 1)
  // O orbe reflete o chat: esperando resposta = pensando; resposta chegando = falando.
  const orbState: OrbState =
    chat.status === 'thinking' ? 'thinking' : chat.status === 'streaming' ? 'speaking' : hotAlert ? 'alert' : manualOrb

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      unlockAudio() // libera o som no primeiro toque/tecla
      if (e.key === 'Escape') return setTab(null)
      if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return
      const k = e.key.toLowerCase()
      if (k in STATE_KEYS) setManualOrb(STATE_KEYS[k])
      else if (k === 'n') night.cycle()
      else if (k === 'l') setLite((v) => !v)
      else if (k === 'a') sleep()
      else if (k === 'f') setFocusOpen((v) => !v)
      else if (k in TAB_KEYS) {
        e.preventDefault() // evita que a letra apareça já dentro do campo de texto
        setTab((cur) => (cur === TAB_KEYS[k] ? null : TAB_KEYS[k]))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [night, sleep])

  // Foco em andamento (ex.: ao reabrir a página): volta para a tela de foco.
  const hadFocus = !!focusNow.data?.session
  useEffect(() => { if (hadFocus) setFocusOpen(true) }, [hadFocus])

  // O modo (dia/noite) e o modo leve vão no <html>, para o fundo do <body> também mudar.
  useEffect(() => {
    document.documentElement.dataset.mode = night.night ? 'night' : 'day'
    document.documentElement.dataset.lite = String(lite)
  }, [night.night, lite])

  // Colunas laterais somem suavemente no modo ambiente; a da direita também recua com o chat aberto.
  const interactive = (hidden: boolean) => ({
    opacity: hidden ? (ambient ? 0 : 0.15) : 1,
    pointerEvents: hidden ? ('none' as const) : ('auto' as const),
  })

  return (
    <div
      className="scanlines relative flex h-full flex-col"
      style={{ filter: ambient ? 'brightness(0.7)' : 'none', transition: 'filter 1.2s ease' }}
    >
      {/* Grade sutil de fundo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(var(--cyan) 1px, transparent 1px), linear-gradient(90deg, var(--cyan) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
        }}
      />

      <header className="relative z-10 flex items-center justify-between px-6 pt-4">
        <span className="hud-title" style={{ fontSize: '1rem' }}>
          G·A·I·A
        </span>
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => openFocus(today.data?.priorities[0]?.id ?? null)} className="hud-title border px-3 py-1" style={{ borderColor: 'var(--line)', fontSize: '0.65rem' }}>
            Foco [F]
          </button>
          <button
            type="button"
            onClick={() => setTab((cur) => (cur ? null : 'chat'))}
            className="hud-title border px-3 py-1"
            style={{ borderColor: tab ? 'var(--cyan)' : 'var(--line)', fontSize: '0.65rem' }}
          >
            Painel [C·I·T·D·M·E·R]{inbox.data && inbox.data.length > 0 ? ` · ${inbox.data.length}` : ''}
          </button>
          <span className="mono text-xs" style={{ color: 'var(--text-dim)' }}>
            v0.4 · FASE 4
          </span>
        </div>
      </header>

      <main className="relative z-10 grid min-h-0 flex-1 grid-cols-1 items-center gap-6 overflow-y-auto px-6 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)] lg:overflow-visible">
        {/* Coluna esquerda: saudação + Meu Dia */}
        <motion.div animate={interactive(ambient)} transition={{ duration: 0.9 }} className="order-2 space-y-5 lg:order-1">
          <Greeting priorities={today.data?.priorities.length ?? 0} nextTime={today.data?.nextEvent?.dueAt && today.data.nextEvent.dueAt.length > 10 ? today.data.nextEvent.dueAt.slice(11, 16) : null} />
          <MyDayPanel items={today.data?.priorities ?? []} onComplete={complete} onFocus={openFocus} delay={0.2} />
          <GrowthCard day={growth.data} onOpen={() => setTab('growth')} delay={0.3} />
        </motion.div>

        {/* Centro: orbe + relógio + próximo compromisso (sempre visíveis) */}
        <div className="order-1 flex min-h-0 flex-col items-center justify-center gap-5 lg:order-2">
          <div className="aspect-square w-full max-w-[min(34rem,52vh)]">
            <Orb state={orbState} night={night.night} dim={ambient ? 0 : 1} lite={lite} wakeKey={wakeKey} />
          </div>
          <Clock ambient={ambient} />
          <NextEventBar event={today.data?.nextEvent ?? null} />
          {bridge.data?.bridge && !focusNow.data?.session && (
            <ResumeCard
              bridge={bridge.data.bridge}
              onResume={() => { const b = bridge.data!.bridge!; api.resolveBridge(b.id).then(() => api.startFocus({ taskId: b.taskId, title: b.taskId ? undefined : b.title, minutes: 25, breakMinutes: 5 })).then(() => { bump(); openFocus(b.taskId) }) }}
              onDismiss={() => mutate(() => api.resolveBridge(bridge.data!.bridge!.id))}
            />
          )}
        </div>

        {/* Coluna direita: lembretes + negócio */}
        <motion.div animate={interactive(ambient || tab !== null)} transition={{ duration: 0.4 }} className="order-3 space-y-5">
          {today.data && (
            <RemindersPanel
              today={today.data}
              onComplete={complete}
              onReschedule={(id, dueAt) => mutate(() => api.updateTask(id, { dueAt }))}
              delay={0.35}
            />
          )}
          {today.error && <div className="mono text-sm" style={{ color: 'var(--amber)' }} role="alert">! {today.error}</div>}
          <BusinessPanel data={BUSINESS} delay={0.5} />
        </motion.div>
      </main>

      <AnimatePresence>
        {(alerts.data?.alerts.length ?? 0) > 0 && !focusOpen && (
          <AlertBanner
            alerts={alerts.data!.alerts}
            onDone={complete}
            onSnooze={(id, m) => mutate(() => api.snooze(id, m))}
            onCancel={(id) => mutate(() => api.updateTask(id, { status: 'cancelled' }))}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {focusOpen && (
          <FocusMode tasks={today.data?.priorities ?? []} initialTaskId={focusTask} version={version} onChanged={bump} onClose={() => setFocusOpen(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {tab && (
          <Drawer tab={tab} onTab={setTab} onClose={() => setTab(null)} inboxCount={inbox.data?.length ?? 0}>
            {tab === 'chat' && <ChatPanel messages={chat.messages} status={chat.status} error={chat.error} onSend={chat.send} onClear={chat.clear} />}
            {tab === 'inbox' && <InboxTab version={version} onChanged={bump} />}
            {tab === 'tasks' && <TasksTab version={version} today={todayStr} onChanged={bump} askGaia={askGaia} />}
            {tab === 'day' && <DayTab version={version} onChanged={bump} />}
            {tab === 'routine' && <RoutineTab onChanged={bump} />}
            {tab === 'memories' && <MemoriesTab version={version} />}
            {tab === 'growth' && <GrowthTab version={version} today={todayStr} onChanged={bump} />}
          </Drawer>
        )}
      </AnimatePresence>

      <div className="relative z-10">
        <StatusBar
          orbState={orbState}
          ai={ai}
          nightLabel={night.override}
          lite={lite}
          hideHints={ambient}
        />
      </div>
    </div>
  )
}
