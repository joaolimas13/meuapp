import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { FastifyInstance } from 'fastify'
import { backupTo, exportAll } from '../backup'
import type { DB } from '../db'
import type { Services } from '../services'

/** Baixar seus dados: JSON completo ou uma cópia do banco SQLite. Passam pela mesma proteção de token das outras rotas. */
export function backupRoutes(app: FastifyInstance, s: Services, db: DB) {
  app.get('/api/export', async (_req, reply) => {
    const day = s.local().date
    return reply
      .header('content-disposition', `attachment; filename="gaia-dados-${day}.json"`)
      .send({ exportedAt: s.now().toISOString(), tables: exportAll(db) })
  })

  app.get('/api/backup', async (_req, reply) => {
    const day = s.local().date
    const tmp = path.join(os.tmpdir(), `gaia-backup-${process.pid}-${Date.now()}.sqlite`)
    await backupTo(db, tmp)
    const data = fs.readFileSync(tmp)
    fs.rmSync(tmp, { force: true })
    return reply
      .header('content-type', 'application/octet-stream')
      .header('content-disposition', `attachment; filename="gaia-backup-${day}.sqlite"`)
      .send(data)
  })
}
