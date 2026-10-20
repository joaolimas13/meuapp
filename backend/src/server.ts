import fastifyStatic from '@fastify/static'
import Fastify, { type FastifyInstance } from 'fastify'
import fs from 'node:fs'
import type { AIProvider } from './ai'
import type { Config } from './config'
import type { DB } from './db'
import crypto from 'node:crypto'
import { BadRequest } from './lib/validate'
import { chatRoutes } from './routes/chat'
import { contentRoutes } from './routes/content'
import { devRoutes } from './routes/dev'
import { inboxRoutes } from './routes/inbox'
import { memoryRoutes } from './routes/memories'
import { routineRoutes } from './routes/routine'
import { backupRoutes } from './routes/backup'
import { wellbeingRoutes } from './routes/wellbeing'
import { taskRoutes } from './routes/tasks'
import { createServices } from './services'

interface Deps {
  config: Config
  provider: AIProvider
  db: DB
  /** Relógio injetável, para testes. */
  now?: () => Date
}

/** Monta o servidor. Recebe tudo por parâmetro, o que facilita os testes. */
export function buildServer(deps: Deps): FastifyInstance {
  const app = Fastify({ logger: false })
  const s = createServices(deps)

  // Entrada inválida vira 400 com mensagem clara em português.
  app.setErrorHandler((error, _req, reply) => {
    const err = error as Error & { statusCode?: number }
    if (err instanceof BadRequest) return reply.code(400).send({ error: err.message })
    const status = err.statusCode ?? 500
    if (status >= 500) console.error('Erro na API:', err.message)
    return reply.code(status).send({ error: status >= 500 ? 'Erro interno.' : err.message })
  })

  // Senha opcional: com GAIA_TOKEN definido, toda a API (menos /api/health) exige o token,
  // no cabeçalho "x-gaia-token" ou na URL (?token=, usado nos links de exportação).
  if (deps.config.token) {
    const want = Buffer.from(deps.config.token)
    app.addHook('onRequest', async (req, reply) => {
      if (!req.url.startsWith('/api/') || req.url.startsWith('/api/health')) return
      const q = new URL(req.url, 'http://x').searchParams.get('token')
      const got = Buffer.from(String(req.headers['x-gaia-token'] ?? q ?? ''))
      // timingSafeEqual exige o mesmo tamanho; comparação em tempo constante evita adivinhar a senha.
      if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) {
        return reply.code(401).send({ error: 'Acesso negado: informe o token do GAIA.' })
      }
    })
  }

  app.get('/api/health', async () => ({
    ok: true,
    auth: !!deps.config.token,
    ai: { provider: s.provider.name, model: s.provider.model, configured: s.provider.isConfigured() },
  }))

  chatRoutes(app, s)
  taskRoutes(app, s)
  inboxRoutes(app, s)
  memoryRoutes(app, s)
  devRoutes(app, s)
  routineRoutes(app, s)
  contentRoutes(app, s)
  wellbeingRoutes(app, s)
  backupRoutes(app, s, deps.db)

  // Serve a interface compilada (npm run build) quando existir: um único servidor para tudo.
  if (fs.existsSync(deps.config.staticDir)) {
    app.register(fastifyStatic, { root: deps.config.staticDir })
    app.setNotFoundHandler((req, reply) => {
      if (req.method === 'GET' && !req.url.startsWith('/api')) return reply.sendFile('index.html')
      return reply.code(404).send({ error: 'Não encontrado' })
    })
  }

  return app
}
