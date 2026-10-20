import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { dailyBackup, exportAll } from '../src/backup'
import { MockProvider } from '../src/ai/mock'
import { loadConfig } from '../src/config'
import { openDb } from '../src/db'
import { buildServer } from '../src/server'

test('exportAll traz todas as tabelas com os dados', () => {
  const db = openDb(':memory:')
  db.prepare("INSERT INTO inbox (text, status, created_at) VALUES ('ideia', 'pending', '2026-10-20')").run()
  const all = exportAll(db)
  assert.ok('tasks' in all && 'vault_items' in all && 'checkins' in all)
  assert.equal(all.inbox.length, 1)
})

test('backup diário: um por dia e mantém só os mais recentes', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gaia-bk-'))
  const db = openDb(path.join(dir, 'gaia.sqlite'))
  for (let d = 1; d <= 9; d++) await dailyBackup(db, path.join(dir, 'backups'), `2026-10-0${d}`, 7)
  assert.equal(await dailyBackup(db, path.join(dir, 'backups'), '2026-10-09', 7), null) // já existe hoje
  const files = fs.readdirSync(path.join(dir, 'backups')).sort()
  assert.equal(files.length, 7)
  assert.equal(files[0], 'gaia-2026-10-03.sqlite')
  // o backup abre como banco válido
  const copy = openDb(path.join(dir, 'backups', files[6]))
  assert.ok(copy.prepare('SELECT count(*) AS n FROM tasks').get())
  fs.rmSync(dir, { recursive: true, force: true })
})

test('API: /api/export e /api/backup baixam os dados', async () => {
  const config = { ...loadConfig({ AI_PROVIDER: 'mock' }), staticDir: '/nao-existe' }
  const app = buildServer({ config, provider: new MockProvider(1), db: openDb(':memory:') })
  await app.inject({ method: 'POST', url: '/api/tasks', payload: { title: 'Teste backup' } })
  const j = await app.inject({ method: 'GET', url: '/api/export' })
  assert.match(String(j.headers['content-disposition']), /gaia-dados-/)
  assert.equal(j.json().tables.tasks.length, 1)
  const b = await app.inject({ method: 'GET', url: '/api/backup' })
  assert.equal(b.statusCode, 200)
  assert.equal(b.rawPayload.subarray(0, 15).toString(), 'SQLite format 3') // assinatura de arquivo SQLite
  await app.close()
})
