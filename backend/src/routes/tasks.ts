import type { FastifyInstance } from 'fastify'
import { buildToday } from '../planner'
import { asObj, optDue, optEnum, optNum, optStr, parseId, reqStr, steps } from '../lib/validate'
import type { Services } from '../services'

const PRIORITIES = ['high', 'normal', 'low'] as const
const INSISTENCE = ['low', 'medium', 'max'] as const
const STATUSES = ['todo', 'done', 'cancelled'] as const

export function taskRoutes(app: FastifyInstance, s: Services) {
  // Tudo o que a tela principal precisa sobre hoje, numa chamada só.
  app.get('/api/today', async () => buildToday(s.tasks.list({ status: 'todo' }), s.local()))

  app.get('/api/tasks', async (req) => {
    const q = asObj(req.query)
    const status = optEnum(q, 'status', ['todo', 'done', 'all'] as const) ?? 'todo'
    return { tasks: s.tasks.list({ status }) }
  })

  app.post('/api/tasks', async (req, reply) => {
    const b = asObj(req.body)
    const task = s.tasks.createWithSteps(
      {
        title: reqStr(b, 'title', 200),
        description: optStr(b, 'description', 2000),
        dueAt: optDue(b, 'dueAt'),
        priority: optEnum(b, 'priority', PRIORITIES),
        category: optStr(b, 'category', 60),
        insistence: optEnum(b, 'insistence', INSISTENCE),
        recurrence: optStr(b, 'recurrence', 60),
        estMinutes: optNum(b, 'estMinutes', 1, 1440),
      },
      steps(b),
    )
    return reply.code(201).send(task)
  })

  app.patch('/api/tasks/:id', async (req, reply) => {
    const id = parseId((req.params as { id: string }).id)
    const b = asObj(req.body)
    const task = s.tasks.update(id, {
      title: optStr(b, 'title', 200),
      description: optStr(b, 'description', 2000),
      dueAt: optDue(b, 'dueAt'),
      priority: optEnum(b, 'priority', PRIORITIES),
      category: optStr(b, 'category', 60),
      insistence: optEnum(b, 'insistence', INSISTENCE),
      status: optEnum(b, 'status', STATUSES),
      estMinutes: optNum(b, 'estMinutes', 1, 1440),
    })
    return task ?? reply.code(404).send({ error: 'Tarefa não encontrada.' })
  })

  app.post('/api/tasks/:id/complete', async (req, reply) => {
    const r = s.tasks.complete(parseId((req.params as { id: string }).id))
    return r ?? reply.code(404).send({ error: 'Tarefa não encontrada.' })
  })

  app.post('/api/tasks/:id/steps', async (req, reply) => {
    const id = parseId((req.params as { id: string }).id)
    const list = steps(asObj(req.body))
    if (!s.tasks.get(id)) return reply.code(404).send({ error: 'Tarefa não encontrada.' })
    if (!list?.length) return reply.code(400).send({ error: 'Envie ao menos um passo.' })
    s.tasks.addSteps(id, list)
    return s.tasks.get(id)
  })

  app.delete('/api/tasks/:id', async (req, reply) => {
    const ok = s.tasks.delete(parseId((req.params as { id: string }).id))
    return ok ? reply.code(204).send() : reply.code(404).send({ error: 'Tarefa não encontrada.' })
  })
}
