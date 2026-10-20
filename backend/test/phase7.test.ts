import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import type { AddressInfo } from 'node:net'
import type { FastifyInstance } from 'fastify'
import type { Checkin } from '../../shared/types'
import { MockProvider } from '../src/ai/mock'
import { loadConfig } from '../src/config'
import { openDb } from '../src/db'
import { buildServer } from '../src/server'
import { checkinSummary, reviewCard, routineStreak } from '../src/wellbeing'

test('revisão espaçada: errou volta ao início, acertou sobe, difícil fica', () => {
  assert.deepEqual(reviewCard(2, 'wrong', '2026-10-20'), { box: 0, next: '2026-10-21' })
  assert.deepEqual(reviewCard(0, 'right', '2026-10-20'), { box: 1, next: '2026-10-23' })
  assert.deepEqual(reviewCard(2, 'hard', '2026-10-20'), { box: 2, next: '2026-10-27' })
  assert.equal(reviewCard(4, 'right', '2026-10-20').box, 4) // teto
})

test('sequência de rotina: hoje pendente não quebra; buraco quebra', () => {
  assert.equal(routineStreak(['2026-10-19', '2026-10-18'], '2026-10-20'), 2)
  assert.equal(routineStreak(['2026-10-20', '2026-10-19'], '2026-10-20'), 2)
  assert.equal(routineStreak(['2026-10-18'], '2026-10-20'), 0)
})

test('check-in: só sugere melhor horário com dados; limita a 2 por dia', () => {
  const c = (date: string, time: string, energy: number): Checkin => ({ id: 1, date, time, energy, mood: 3, note: '' })
  const few = checkinSummary([c('2026-10-19', '10:00', 5)], { date: '2026-10-20', time: '10:00' })
  assert.equal(few.best, null)
  const hist = [1, 2, 3].flatMap((d) => [c(`2026-10-0${d}`, '10:00', 5), c(`2026-10-0${d}`, '16:00', 2)])
  const s = checkinSummary(hist, { date: '2026-10-20', time: '10:00' })
  assert.equal(s.best?.label, '9h–12h')
  assert.equal(s.due, true)
  const twice = checkinSummary([c('2026-10-20', '07:30', 3), c('2026-10-20', '13:00', 3)], { date: '2026-10-20', time: '19:00' })
  assert.equal(twice.due, false)
  assert.equal(checkinSummary([], { date: '2026-10-20', time: '23:00' }).due, false) // tarde da noite
})

// ------------------------------------------------------------------ API
const NOW = new Date('2026-10-20T18:00:00Z') // terça, 15:00 em São Paulo
let app: FastifyInstance
let base: string
before(async () => {
  const config = { ...loadConfig({ AI_PROVIDER: 'mock' }), staticDir: '/nao-existe' }
  app = buildServer({ config, provider: new MockProvider(1), db: openDb(':memory:'), now: () => NOW })
  await app.listen({ port: 0, host: '127.0.0.1' })
  base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`
})
after(() => app.close())
const call = async (method: string, path: string, body?: unknown) => {
  const res = await fetch(base + path, { method, headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
  const text = await res.text()
  return { status: res.status, json: text && res.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text }
}

test('API check-in: valida 1–5 e devolve o resumo', async () => {
  assert.equal((await call('POST', '/api/checkins', { energy: 9, mood: 3 })).status, 400)
  const r = await call('POST', '/api/checkins', { energy: 4, mood: 3 })
  assert.equal(r.status, 201)
  assert.equal(r.json.today.length, 1)
  assert.equal(r.json.due, false)
})

test('API estudos: cartão novo vence amanhã; revisar muda a caixa', async () => {
  const v = (await call('POST', '/api/study/cards', { topic: 'Hidráulica', question: 'O que é vazão?', answer: 'Volume por tempo' })).json
  assert.equal(v.total, 1)
  assert.equal(v.dueCount, 1) // cartão novo já pode ser revisado hoje
  const id = v.due[0].id
  assert.equal((await call('POST', `/api/study/cards/${id}/review`, { result: 'nada' })).status, 400)
  const after = (await call('POST', `/api/study/cards/${id}/review`, { result: 'right' })).json
  assert.equal(after.dueCount, 0)
  assert.equal((await call('DELETE', `/api/study/cards/${id}`)).status, 204)
  assert.equal((await call('GET', '/api/study')).json.total, 0)
})

test('API treino: valida e gera a tarefa do dia uma única vez', async () => {
  assert.equal((await call('PUT', '/api/training', { plan: [{ weekday: 9, title: 'x', time: '18:00' }] })).status, 400)
  await call('PUT', '/api/training', { plan: [{ weekday: 2, title: 'Corrida leve', time: '18:00' }] })
  await call('GET', '/api/today')
  await call('GET', '/api/alerts')
  const list = (await call('GET', '/api/tasks?status=todo')).json.tasks
  assert.equal(list.filter((t: { title: string }) => t.title.startsWith('Treino')).length, 1)
  assert.equal(list.filter((t: { title: string }) => t.title === 'Hora de desacelerar').length, 1)
})

test('API cofre: executar cria tarefa; descartar tira da lista aberta', async () => {
  const it = (await call('POST', '/api/vault', { title: 'Chaveiro com LED', kind: 'projeto' })).json
  assert.equal((await call('PATCH', `/api/vault/${it.id}`, { status: 'xx' })).status, 400)
  await call('PATCH', `/api/vault/${it.id}`, { status: 'executar' })
  const tasks = (await call('GET', '/api/tasks?status=todo')).json.tasks
  assert.ok(tasks.some((t: { title: string }) => t.title === 'Chaveiro com LED'))
  const other = (await call('POST', '/api/vault', { title: 'Ideia fraca' })).json
  const items = (await call('PATCH', `/api/vault/${other.id}`, { status: 'descartada' })).json.items
  assert.ok(!items.some((i: { id: number }) => i.id === other.id)) // descartada sai da lista aberta
})

test('API resumos: bem-estar e revisão semanal respondem com tom construtivo', async () => {
  const w = (await call('GET', '/api/wellbeing/summary')).json
  assert.equal(typeof w.message, 'string')
  assert.ok(w.message.length > 0)
  const r = (await call('GET', '/api/review/weekly')).json
  assert.equal(r.to, '2026-10-20')
  assert.ok(Array.isArray(r.highlights) && r.highlights.length > 0)
  assert.ok(Array.isArray(r.nextWeek))
})
