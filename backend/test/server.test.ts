import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import type { AddressInfo } from 'node:net'
import type { FastifyInstance } from 'fastify'
import { AIError, type AIProvider } from '../src/ai'
import { MockProvider } from '../src/ai/mock'
import { loadConfig } from '../src/config'
import { openDb } from '../src/db'
import { buildServer } from '../src/server'

const config = { ...loadConfig({ AI_PROVIDER: 'mock' }), staticDir: '/nao-existe' }

async function start(provider: AIProvider) {
  const app = buildServer({ config, provider, db: openDb(':memory:') })
  await app.listen({ port: 0, host: '127.0.0.1' })
  const base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`
  return { app, base }
}

async function chat(base: string, message: string) {
  const res = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message }),
  })
  const text = await res.text()
  const events = text.split('\n\n').filter(Boolean).map((l) => JSON.parse(l.replace(/^data: /, '')))
  return { res, events }
}

let app: FastifyInstance
let base: string
before(async () => ({ app, base } = await start(new MockProvider(1))))
after(() => app.close())

test('health informa o provedor de IA', async () => {
  const j = await (await fetch(`${base}/api/health`)).json()
  assert.deepEqual(j, { ok: true, auth: false, ai: { provider: 'mock', model: 'mock-1', configured: true } })
})

test('chat devolve deltas em streaming, termina com done e salva o histórico', async () => {
  const { res, events } = await chat(base, 'Olá GAIA')
  assert.match(res.headers.get('content-type') ?? '', /text\/event-stream/)
  const deltas = events.filter((e) => e.type === 'delta')
  assert.ok(deltas.length > 3, 'deveria vir em vários pedaços')
  assert.equal(events.at(-1).type, 'done')
  const full = deltas.map((d) => d.text).join('')
  assert.match(full, /Olá GAIA/)

  const hist = (await (await fetch(`${base}/api/chat/history`)).json()).messages
  assert.deepEqual(hist.map((m: { role: string }) => m.role), ['user', 'assistant'])
  assert.equal(hist[1].content, full)
})

test('rejeita mensagem vazia', async () => {
  const res = await fetch(`${base}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: '   ' }) })
  assert.equal(res.status, 400)
})

test('apagar histórico limpa tudo', async () => {
  const res = await fetch(`${base}/api/chat/history`, { method: 'DELETE' })
  assert.equal(res.status, 204)
  assert.deepEqual((await (await fetch(`${base}/api/chat/history`)).json()).messages, [])
})

test('erro da IA vira evento error em português e não salva resposta', async () => {
  const failing: AIProvider = {
    name: 'falho', model: 'x', isConfigured: () => true,
    // eslint-disable-next-line require-yield
    async *streamChat() { throw new AIError('Limite de uso atingido.', 'rate_limit') },
  }
  const s = await start(failing)
  try {
    const { events } = await chat(s.base, 'oi')
    assert.deepEqual(events, [{ type: 'error', code: 'rate_limit', message: 'Limite de uso atingido.', actions: 0 }])
    const hist = (await (await fetch(`${s.base}/api/chat/history`)).json()).messages
    assert.deepEqual(hist.map((m: { role: string }) => m.role), ['user'])
  } finally {
    await s.app.close()
  }
})

test('o histórico vai como contexto nas conversas seguintes', async () => {
  const seen: number[] = []
  const spy: AIProvider = {
    name: 'spy', model: 'x', isConfigured: () => true,
    async *streamChat({ messages }) { seen.push(messages.length); yield { type: 'text' as const, text: 'ok' } },
  }
  const s = await start(spy)
  try {
    await chat(s.base, 'um')
    await chat(s.base, 'dois')
    assert.deepEqual(seen, [1, 3]) // 1ª: [um]; 2ª: [um, ok, dois]
  } finally {
    await s.app.close()
  }
})
