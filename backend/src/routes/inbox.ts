import type { FastifyInstance } from 'fastify'
import { MEMORY_CATEGORIES } from '../../../shared/types'
import { suggestAll } from '../inbox/suggest'
import { asObj, optDue, optEnum, optStr, parseId, reqStr } from '../lib/validate'
import type { Services } from '../services'

export function inboxRoutes(app: FastifyInstance, s: Services) {
  // Captura rápida: salva na hora, sem pedir categoria, prazo nem confirmação.
  app.post('/api/inbox', async (req, reply) => {
    const item = s.inbox.add(reqStr(asObj(req.body), 'text', 1000))
    return reply.code(201).send(item)
  })

  app.get('/api/inbox', async () => ({ items: s.inbox.pending() }))

  // O GAIA sugere o que cada anotação é; nada é criado até você aprovar.
  app.post('/api/inbox/suggest', async () => ({
    suggestions: await suggestAll(s.provider, s.inbox.pending(), s.local()),
  }))

  // Aprovar = transformar a anotação em tarefa ou memória.
  app.post('/api/inbox/:id/accept', async (req, reply) => {
    const id = parseId((req.params as { id: string }).id)
    const item = s.inbox.get(id)
    if (!item || item.status !== 'pending') return reply.code(404).send({ error: 'Anotação não encontrada.' })

    const b = asObj(req.body)
    const kind = optEnum(b, 'kind', ['task', 'memory'] as const)
    if (!kind) return reply.code(400).send({ error: '"kind" deve ser task ou memory.' })
    const title = optStr(b, 'title', 200) || item.text.slice(0, 200)

    let created: { kind: 'task' | 'memory'; id: number }
    if (kind === 'task') {
      created = { kind, id: s.tasks.create({ title, dueAt: optDue(b, 'dueAt') ?? null }).id }
    } else {
      const category = optEnum(b, 'category', MEMORY_CATEGORIES) ?? 'notas'
      created = { kind, id: s.memories.add({ text: title, category }).id }
    }
    s.inbox.setStatus(id, 'done')
    return created
  })

  app.post('/api/inbox/:id/discard', async (req, reply) => {
    const ok = s.inbox.setStatus(parseId((req.params as { id: string }).id), 'discarded')
    return ok ? reply.code(204).send() : reply.code(404).send({ error: 'Anotação não encontrada.' })
  })
}
