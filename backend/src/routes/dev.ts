import type { FastifyInstance } from 'fastify'
import { asObj, BadRequest, optBool, optDate, optEnum, optNum, optStr, parseId, reqStr } from '../lib/validate'
import type { Services } from '../services'

/** Desenvolvimento pessoal: registro do dia, metas, pontuação e sequência. */
export function devRoutes(app: FastifyInstance, s: Services) {
  const today = () => s.local().date
  const view = (date: string) => s.dev.day(date, today())

  app.get('/api/dev/day', async (req) => view(optDate(asObj(req.query), 'date') ?? today()))

  // Salva só o que foi enviado; o resto do dia continua como estava.
  app.put('/api/dev/day/:date', async (req) => {
    const date = optDate({ date: (req.params as { date: string }).date }, 'date')!
    const b = asObj(req.body)
    const patch = {
      exercised: optBool(b, 'exercised'),
      exerciseNote: optStr(b, 'exerciseNote', 200),
      studied: optBool(b, 'studied'),
      studyHours: b.studyHours === null ? null : optNum(b, 'studyHours', 0, 24),
      pages: optNum(b, 'pages', 0, 5000),
      sleepHours: b.sleepHours === null ? null : optNum(b, 'sleepHours', 0, 24),
      waterL: optNum(b, 'waterL', 0, 20),
    }
    // Tira o que não veio (undefined) para não apagar dados existentes.
    s.dev.repo.saveLog(date, Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)))
    return view(date)
  })

  app.post('/api/dev/goals', async (req, reply) => {
    const b = asObj(req.body)
    const kind = optEnum(b, 'kind', ['fixed', 'daily'] as const)
    if (!kind) throw new BadRequest('"kind" deve ser fixed ou daily.')
    const date = optDate(b, 'date') ?? today()
    s.dev.repo.addGoal({ title: reqStr(b, 'title', 120), kind, date, createdOn: date })
    return reply.code(201).send(view(date))
  })

  app.delete('/api/dev/goals/:id', async (req, reply) => {
    const ok = s.dev.repo.removeGoal(parseId((req.params as { id: string }).id), today())
    return ok ? view(today()) : reply.code(404).send({ error: 'Meta não encontrada.' })
  })

  app.put('/api/dev/goals/:id/check', async (req, reply) => {
    const id = parseId((req.params as { id: string }).id)
    const b = asObj(req.body)
    const date = optDate(b, 'date') ?? today()
    const done = optBool(b, 'done')
    if (done === undefined) throw new BadRequest('"done" é obrigatório.')
    if (!s.dev.repo.getGoal(id)) return reply.code(404).send({ error: 'Meta não encontrada.' })
    s.dev.repo.setCheck(id, date, done)
    return view(date)
  })

  app.get('/api/dev/settings', async () => ({ targets: s.dev.repo.targets(), weights: s.dev.repo.weights() }))

  app.put('/api/dev/settings', async (req) => {
    const b = asObj(req.body)
    const t = asObj(b.targets)
    const w = asObj(b.weights)
    const clean = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>
    s.dev.repo.saveTargets(
      clean({
        sleepHours: optNum(t, 'sleepHours', 1, 16),
        sleepTolerance: optNum(t, 'sleepTolerance', 0, 4),
        pages: optNum(t, 'pages', 1, 2000),
        waterL: optNum(t, 'waterL', 0.1, 20),
      }),
    )
    s.dev.repo.saveWeights(
      clean({
        goals: optNum(w, 'goals', 0, 100),
        sleep: optNum(w, 'sleep', 0, 100),
        exercise: optNum(w, 'exercise', 0, 100),
        study: optNum(w, 'study', 0, 100),
        reading: optNum(w, 'reading', 0, 100),
      }),
    )
    return { targets: s.dev.repo.targets(), weights: s.dev.repo.weights() }
  })
}
