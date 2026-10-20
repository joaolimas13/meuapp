import type { FastifyInstance } from 'fastify'
import { CONTENT_KINDS, CONTENT_STEPS, type ContentToday } from '../../../shared/types'
import { addDays, localNow } from '../lib/time'
import { asObj, BadRequest, optBool, optDate, optEnum, optStr, parseId, reqStr } from '../lib/validate'
import type { Services } from '../services'

const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay() // 0 = domingo

/** Rotas do calendário de conteúdo e do lembrete de constância. */
export function contentRoutes(app: FastifyInstance, s: Services) {
  const toLocalDate = (iso: string) => localNow(s.config.timezone, new Date(iso)).date

  app.get('/api/content', async (req) => {
    const q = asObj(req.query)
    const today = s.local().date
    const from = optDate(q, 'from') ?? today
    const to = optDate(q, 'to') ?? addDays(from, 13)
    return s.content.list(from, to)
  })

  app.post('/api/content', async (req, reply) => {
    const b = asObj(req.body)
    const post = s.content.create({
      title: reqStr(b, 'title', 200),
      kind: optEnum(b, 'kind', CONTENT_KINDS),
      product: optStr(b, 'product', 100),
      notes: optStr(b, 'notes', 1000),
      date: b.date === null ? null : optDate(b, 'date'),
    })
    return reply.code(201).send(post)
  })

  app.patch('/api/content/:id', async (req, reply) => {
    const b = asObj(req.body)
    const post = s.content.update(parseId((req.params as { id: string }).id), {
      title: optStr(b, 'title', 200),
      kind: optEnum(b, 'kind', CONTENT_KINDS),
      product: optStr(b, 'product', 100),
      notes: optStr(b, 'notes', 1000),
      date: b.date === null ? null : optDate(b, 'date'),
    })
    return post ?? reply.code(404).send({ error: 'Conteúdo não encontrado.' })
  })

  app.put('/api/content/:id/steps', async (req, reply) => {
    const b = asObj(req.body)
    const step = optEnum(b, 'step', CONTENT_STEPS)
    const done = optBool(b, 'done')
    if (!step || done === undefined) throw new BadRequest('Informe "step" e "done".')
    const post = s.content.setStep(parseId((req.params as { id: string }).id), step, done, s.now().toISOString())
    return post ?? reply.code(404).send({ error: 'Conteúdo não encontrado.' })
  })

  app.delete('/api/content/:id', async (req, reply) => {
    return s.content.delete(parseId((req.params as { id: string }).id)) ? reply.code(204).send() : reply.code(404).send({ error: 'Conteúdo não encontrado.' })
  })

  // "Hoje é dia de postar": usado pelo cartão da tela principal.
  app.get('/api/content/today', async (): Promise<ContentToday> => {
    const now = s.local()
    const g = s.settings.general().content
    const postingDay = g.days.includes(weekday(now.date))
    const done = s.content.postedAtLocalDay(now.date, toLocalDate)
    const todays = s.content.list(now.date, now.date).posts.filter((p) => !p.posted)
    return { date: now.date, postingDay, pending: postingDay && !done, remindNow: now.time >= g.remindAt, remindAt: g.remindAt, post: todays[0] ?? null }
  })
}
