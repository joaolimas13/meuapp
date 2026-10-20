import type { FastifyInstance } from 'fastify'
import { FOCUS_OUTCOMES, type FocusOutcome } from '../db/focusRepo'
import { nextStep } from '../db/tasksRepo'
import { addMinutes, nowDt, localNow } from '../lib/time'
import { asObj, BadRequest, optBool, optDate, optEnum, optNum, optStr, parseId, reqStr } from '../lib/validate'
import { computeAlerts, isQuiet } from '../reminders'
import { dailyReview, planDay } from '../schedule'
import type { Services } from '../services'

/** Rotas da Fase 4: alertas, soneca, foco, "onde eu parei", âncoras, plano do dia, revisão e configurações. */
export function routineRoutes(app: FastifyInstance, s: Services) {
  // ---------------------------------------------------------------- alertas
  app.get('/api/alerts', async () => {
    const now = s.local()
    const g = s.settings.general()
    return { alerts: computeAlerts(s.tasks.list({ status: 'todo' }), now, g, s.focus.snoozes()), quiet: isQuiet(now, g), now: nowDt(now) }
  })

  app.post('/api/tasks/:id/snooze', async (req, reply) => {
    const id = parseId((req.params as { id: string }).id)
    if (!s.tasks.get(id)) return reply.code(404).send({ error: 'Tarefa não encontrada.' })
    const minutes = optNum(asObj(req.body), 'minutes', 1, 240) ?? 10
    const until = addMinutes(nowDt(s.local()), minutes)
    s.focus.snooze(id, until)
    return { until }
  })

  // ---------------------------------------------------------------- foco
  const focusView = () => ({ session: s.focus.current(), serverNow: s.now().toISOString() })

  /** Ao terminar/interromper um bloco, guarda onde parei e o próximo passo. */
  const saveBridge = (taskId: number | null, title: string, note: string, next?: string) => {
    const task = taskId ? s.tasks.get(taskId) : null
    const nextTitle = next ?? (task ? nextStep(task)?.title ?? '' : '')
    return s.focus.addBridge({ taskId, title, note, nextStep: nextTitle })
  }

  app.get('/api/focus', async () => focusView())

  app.post('/api/focus', async (req) => {
    const b = asObj(req.body)
    const taskId = b.taskId === undefined || b.taskId === null ? null : parseId(b.taskId)
    const task = taskId ? s.tasks.get(taskId) : null
    if (taskId && !task) throw new BadRequest('Tarefa não encontrada.')
    const title = optStr(b, 'title', 200) ?? task?.title
    if (!title) throw new BadRequest('Informe uma tarefa ou um título.')
    // Só um foco por vez: o anterior vira ponte "interrompido".
    const prev = s.focus.current()
    if (prev) {
      s.focus.finish(prev.id, 'interrupted', s.now().toISOString())
      saveBridge(prev.taskId, prev.title, 'Bloco interrompido')
    }
    s.focus.start(
      { taskId, title, minutes: optNum(b, 'minutes', 1, 180) ?? 25, breakMinutes: optNum(b, 'breakMinutes', 0, 60) ?? 5 },
      s.now().toISOString(),
    )
    return focusView()
  })

  app.post('/api/focus/:id/finish', async (req, reply) => {
    const id = parseId((req.params as { id: string }).id)
    const sess = s.focus.getSession(id)
    if (!sess) return reply.code(404).send({ error: 'Sessão de foco não encontrada.' })
    const b = asObj(req.body)
    const outcome = optEnum(b, 'outcome', FOCUS_OUTCOMES) as FocusOutcome | undefined
    if (!outcome) throw new BadRequest('"outcome" deve ser um de: ' + FOCUS_OUTCOMES.join(', ') + '.')
    if (!sess.endedAt) s.focus.finish(id, outcome, s.now().toISOString())
    if (outcome === 'done') {
      if (sess.taskId) s.tasks.complete(sess.taskId)
    } else if (outcome !== 'continue') {
      // "continue" = mais um bloco da mesma tarefa: não é uma interrupção, então não deixa ponte.
      saveBridge(sess.taskId, sess.title, optStr(b, 'note', 500) ?? '', optStr(b, 'nextStep', 300))
    }
    return focusView()
  })

  // ---------------------------------------------------------------- "onde eu parei?"
  app.get('/api/bridge', async () => ({ bridge: s.focus.lastBridge(), focus: s.focus.current() }))
  app.post('/api/bridge', async (req) => {
    const b = asObj(req.body)
    return saveBridge(null, reqStr(b, 'title', 200), optStr(b, 'note', 500) ?? '', optStr(b, 'nextStep', 300))
  })
  app.post('/api/bridge/:id/resolve', async (req, reply) => {
    return s.focus.resolveBridge(parseId((req.params as { id: string }).id)) ? reply.code(204).send() : reply.code(404).send({ error: 'Ponte não encontrada.' })
  })

  // ---------------------------------------------------------------- âncoras
  app.get('/api/anchors', async (req) => ({ anchors: s.anchors.list(optDate(asObj(req.query), 'date') ?? s.local().date) }))
  app.post('/api/anchors/:id/items', async (req, reply) => {
    const ok = s.anchors.addItem(parseId((req.params as { id: string }).id), reqStr(asObj(req.body), 'text', 120))
    return ok ? reply.code(201).send({ anchors: s.anchors.list(s.local().date) }) : reply.code(404).send({ error: 'Âncora não encontrada.' })
  })
  app.delete('/api/anchor-items/:id', async (req, reply) => {
    return s.anchors.deleteItem(parseId((req.params as { id: string }).id)) ? reply.code(204).send() : reply.code(404).send({ error: 'Item não encontrado.' })
  })
  app.put('/api/anchor-items/:id/check', async (req, reply) => {
    const b = asObj(req.body)
    const done = optBool(b, 'done')
    if (done === undefined) throw new BadRequest('"done" é obrigatório.')
    const date = optDate(b, 'date') ?? s.local().date
    return s.anchors.check(parseId((req.params as { id: string }).id), date, done)
      ? { anchors: s.anchors.list(date) }
      : reply.code(404).send({ error: 'Item não encontrado.' })
  })

  // ---------------------------------------------------------------- plano e revisão
  app.get('/api/plan', async (req) => {
    const now = s.local()
    return planDay(s.tasks.list({ status: 'todo' }), optDate(asObj(req.query), 'date') ?? now.date, now, s.settings.general())
  })

  app.get('/api/review/daily', async () => {
    const now = s.local()
    const doneToday = s.tasks.list({ status: 'done' }).filter((t) => t.parentId === null && t.completedAt && localNow(s.config.timezone, new Date(t.completedAt)).date === now.date)
    return dailyReview(s.tasks.list({ status: 'todo' }), doneToday, now, s.dev.scoreFor(now.date).total)
  })

  // ---------------------------------------------------------------- configurações gerais
  app.get('/api/settings/general', async () => s.settings.general())
  app.put('/api/settings/general', async (req) => {
    const b = asObj(req.body)
    return s.settings.saveGeneral(b as never)
  })
}
