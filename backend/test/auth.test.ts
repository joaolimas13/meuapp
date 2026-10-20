import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MockProvider } from '../src/ai/mock'
import { assertSafeExposure, loadConfig } from '../src/config'
import { openDb } from '../src/db'
import { buildServer } from '../src/server'

const TOKEN = 'uma-senha-bem-longa-123'
const mk = (env: Record<string, string> = {}) =>
  buildServer({ config: { ...loadConfig({ AI_PROVIDER: 'mock', GAIA_TOKEN: TOKEN, ...env }), staticDir: '/nao-existe' }, provider: new MockProvider(1), db: openDb(':memory:') })

test('com GAIA_TOKEN: API exige o token; health fica aberto', async () => {
  const app = mk()
  const get = (url: string, headers: Record<string, string> = {}) => app.inject({ method: 'GET', url, headers })
  assert.equal((await get('/api/tasks')).statusCode, 401)
  assert.equal((await get('/api/tasks', { 'x-gaia-token': 'errado-errado-errado' })).statusCode, 401)
  assert.equal((await get('/api/tasks', { 'x-gaia-token': 'curto' })).statusCode, 401) // tamanho diferente não derruba o servidor
  assert.equal((await get('/api/tasks', { 'x-gaia-token': TOKEN })).statusCode, 200)
  assert.equal((await get(`/api/memories/export?format=md&token=${TOKEN}`)).statusCode, 200)
  const h = await get('/api/health')
  assert.equal(h.statusCode, 200)
  assert.equal(h.json().auth, true)
  const post = await app.inject({ method: 'POST', url: '/api/inbox', payload: { text: 'x' } })
  assert.equal(post.statusCode, 401)
  await app.close()
})

test('sem GAIA_TOKEN a API segue aberta (uso local)', async () => {
  const app = buildServer({ config: { ...loadConfig({ AI_PROVIDER: 'mock' }), staticDir: '/nao-existe' }, provider: new MockProvider(1), db: openDb(':memory:') })
  assert.equal((await app.inject({ method: 'GET', url: '/api/tasks' })).statusCode, 200)
  await app.close()
})

test('não sobe exposto à rede sem token forte', () => {
  assert.doesNotThrow(() => assertSafeExposure(loadConfig({ AI_PROVIDER: 'mock' })))
  assert.throws(() => assertSafeExposure(loadConfig({ AI_PROVIDER: 'mock', HOST: '0.0.0.0' })), /GAIA_TOKEN/)
  assert.throws(() => assertSafeExposure(loadConfig({ AI_PROVIDER: 'mock', HOST: '0.0.0.0', GAIA_TOKEN: 'curto' })), /GAIA_TOKEN/)
  assert.doesNotThrow(() => assertSafeExposure(loadConfig({ AI_PROVIDER: 'mock', HOST: '0.0.0.0', GAIA_TOKEN: TOKEN })))
})
