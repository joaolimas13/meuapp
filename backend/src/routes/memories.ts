import type { FastifyInstance } from 'fastify'
import { MEMORY_CATEGORIES } from '../../../shared/types'
import { asObj, BadRequest, optEnum, optNum, optStr, parseId, reqStr } from '../lib/validate'
import type { Services } from '../services'

function tagsOf(b: Record<string, unknown>): string[] | undefined {
  const v = b.tags
  if (v === undefined || v === null) return undefined
  if (!Array.isArray(v) || v.length > 10 || v.some((t) => typeof t !== 'string' || t.length > 30)) {
    throw new BadRequest('"tags" deve ser uma lista de até 10 textos curtos.')
  }
  return (v as string[]).map((t) => t.trim()).filter(Boolean)
}

export function memoryRoutes(app: FastifyInstance, s: Services) {
  app.get('/api/memories', async (req) => {
    const q = asObj(req.query)
    const category = optEnum(q, 'category', MEMORY_CATEGORIES)
    const text = optStr(q, 'q', 200)
    return { memories: text ? s.memories.search(text, { category, limit: 50 }) : s.memories.list(category) }
  })

  // Você tem o controle total: exporta tudo em JSON ou Markdown.
  app.get('/api/memories/export', async (req, reply) => {
    const format = optEnum(asObj(req.query), 'format', ['json', 'md'] as const) ?? 'json'
    const day = s.local().date
    if (format === 'md') {
      return reply
        .header('content-type', 'text/markdown; charset=utf-8')
        .header('content-disposition', `attachment; filename="gaia-memorias-${day}.md"`)
        .send(s.memories.toMarkdown())
    }
    return reply
      .header('content-disposition', `attachment; filename="gaia-memorias-${day}.json"`)
      .send({ exportedAt: s.now().toISOString(), memories: s.memories.list() })
  })

  app.post('/api/memories', async (req, reply) => {
    const b = asObj(req.body)
    const m = s.memories.add({
      text: reqStr(b, 'text', 2000),
      category: optEnum(b, 'category', MEMORY_CATEGORIES),
      tags: tagsOf(b),
      importance: optNum(b, 'importance', 1, 5),
    })
    return reply.code(201).send(m)
  })

  app.patch('/api/memories/:id', async (req, reply) => {
    const id = parseId((req.params as { id: string }).id)
    const b = asObj(req.body)
    const m = s.memories.update(id, {
      text: optStr(b, 'text', 2000),
      category: optEnum(b, 'category', MEMORY_CATEGORIES),
      tags: tagsOf(b),
      importance: optNum(b, 'importance', 1, 5),
    })
    return m ?? reply.code(404).send({ error: 'Memória não encontrada.' })
  })

  app.delete('/api/memories/:id', async (req, reply) => {
    const ok = s.memories.delete(parseId((req.params as { id: string }).id))
    return ok ? reply.code(204).send() : reply.code(404).send({ error: 'Memória não encontrada.' })
  })
}
