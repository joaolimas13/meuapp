import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import type { AddressInfo } from 'node:net'
import type { FastifyInstance } from 'fastify'
import type { Task } from '../../shared/types'
import { MockProvider } from '../src/ai/mock'
import { loadConfig } from '../src/config'
import { openDb } from '../src/db'
import { DEFAULT_GENERAL } from '../src/db/settingsRepo'
import { addMinutes, inWindow, minutesBetween } from '../src/lib/time'
import { computeAlerts } from '../src/reminders'
import { isWorkDay, planDay } from '../src/schedule'
import { buildServer } from '../src/server'

const task = (o: Partial<Task>): Task => ({
  id: 1, title: 'Remédio', description: '', dueAt: '2026-10-20T15:00', priority: 'normal', category: '', status: 'todo',
  recurrence: null, insistence: 'max', parentId: null, position: 0, estMinutes: null, createdAt: '', updatedAt: '', completedAt: null, steps: [], ...o,
})
const at = (time: string) => ({ date: '2026-10-20', time })
const G = DEFAULT_GENERAL

test('tempo: minutesBetween, addMinutes e janela que cruza a meia-noite', () => {
  assert.equal(minutesBetween('2026-10-20T15:00', '2026-10-20T15:45'), 45)
  assert.equal(addMinutes('2026-10-20T23:50', 20), '2026-10-21T00:10')
  assert.ok(inWindow('02:00', '23:00', '06:00'))
  assert.ok(!inWindow('12:00', '23:00', '06:00'))
})

test('lembretes: avisos antes, escalonamento depois e teto por insistência', () => {
  const t = task({})
  const lv = (time: string, tk = t) => computeAlerts([tk], at(time), G, new Map())[0]
  assert.equal(lv('14:20'), undefined) // 40 min antes: nada
  assert.deepEqual([lv('14:40').kind, lv('14:40').level, lv('14:40').key], ['before', 0, '1:before:30'])
  assert.equal(lv('14:56').key, '1:before:5')
  assert.equal(lv('15:00').level, 1)
  assert.equal(lv('15:06').level, 2)
  assert.equal(lv('15:20').level, 3)
  assert.notEqual(lv('15:20').key, lv('15:35').key) // repete em intervalos crescentes
  assert.equal(lv('19:01'), undefined) // passou de 240 min: para de insistir
  const med = task({ insistence: 'medium' })
  assert.equal(lv('15:20', med).level, 2) // média: teto 2
  assert.equal(lv('16:01', med), undefined)
  const low = task({ insistence: 'low' })
  assert.equal(lv('14:50', low), undefined) // baixa: sem aviso prévio
  assert.equal(lv('15:10', low).level, 1)
  assert.equal(lv('15:16', low), undefined)
})

test('lembretes: silêncio/não perturbe deixam só visual e soneca esconde', () => {
  const t = task({ dueAt: '2026-10-20T23:30' })
  assert.equal(computeAlerts([t], at('23:40'), G, new Map())[0].level, 0) // 23:00–06:00
  assert.equal(computeAlerts([task({})], at('15:10'), { ...G, dnd: true }, new Map())[0].level, 0)
  assert.equal(computeAlerts([task({})], at('15:10'), G, new Map([[1, '2026-10-20T15:30']])).length, 0)
  assert.equal(computeAlerts([task({})], at('15:31'), G, new Map([[1, '2026-10-20T15:30']])).length, 1)
  assert.equal(computeAlerts([task({ dueAt: '2026-10-20' })], at('15:10'), G, new Map()).length, 0) // sem horário
})

test('escala 24h/72h: ciclo de 4 dias', () => {
  const g = { ...G, shift: { enabled: true, anchorDate: '2026-10-20', workDays: 1, offDays: 3 } }
  assert.deepEqual(['2026-10-20', '2026-10-21', '2026-10-23', '2026-10-24', '2026-10-16'].map((d) => isWorkDay(d, g)), [true, false, false, true, true])
  assert.equal(isWorkDay('2026-10-20', G), false) // desligada
})

test('plano do dia: fixas ficam, flexíveis preenchem lacunas; plantão limita', () => {
  const fixed = task({ id: 1, title: 'Reunião', dueAt: '2026-10-20T16:00', estMinutes: 60 })
  const a = task({ id: 2, title: 'A', dueAt: null, priority: 'high', estMinutes: 60 })
  const b = task({ id: 3, title: 'B', dueAt: null, estMinutes: 30 })
  const c = task({ id: 4, title: 'C', dueAt: null, estMinutes: 30 })
  const p = planDay([fixed, a, b, c], '2026-10-20', at('15:02'), G)
  assert.deepEqual(p.blocks.map((x) => [x.title, x.start.slice(11)]), [['Reunião', '16:00'], ['A', '17:00'], ['B', '18:00'], ['C', '18:30']])
  const g = { ...G, shift: { enabled: true, anchorDate: '2026-10-20', workDays: 1, offDays: 3 } }
  const w = planDay([a, b, c], '2026-10-20', at('09:00'), g)
  assert.equal(w.workDay, true)
  assert.equal(w.blocks.length, 2)
  assert.equal(w.unplaced.length, 1)
})

// ------------------------------------------------------------------ API
const NOW = new Date('2026-10-20T18:00:00Z') // 15:00 em São Paulo
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

test('API alertas: tarefa vencida agora gera alerta nível 1 e soneca o esconde', async () => {
  const t = (await call('POST', '/api/tasks', { title: 'Tomar remédio', dueAt: '2026-10-20T15:00', insistence: 'max' })).json
  const a = (await call('GET', '/api/alerts')).json
  assert.equal(a.alerts.length, 1)
  assert.equal(a.alerts[0].level, 1)
  assert.equal(a.quiet, false)
  assert.equal((await call('POST', `/api/tasks/${t.id}/snooze`, { minutes: 10 })).json.until, '2026-10-20T15:10')
  assert.equal((await call('GET', '/api/alerts')).json.alerts.length, 0)
  assert.equal((await call('POST', '/api/tasks/999/snooze', {})).status, 404)
  await call('POST', `/api/tasks/${t.id}/complete`)
})

test('API foco: iniciar, concluir com ponte, "onde eu parei" e retomar', async () => {
  const t = (await call('POST', '/api/tasks', { title: 'Escrever relatório', steps: [{ title: 'Abrir o arquivo' }, { title: 'Escrever a introdução' }] })).json
  const f = (await call('POST', '/api/focus', { taskId: t.id, minutes: 25 })).json
  assert.equal(f.session.title, 'Escrever relatório')
  assert.equal(f.session.minutes, 25)
  // um segundo foco interrompe o primeiro e deixa uma ponte
  const f2 = (await call('POST', '/api/focus', { title: 'Responder e-mails', minutes: 10 })).json
  assert.notEqual(f2.session.id, f.session.id)
  let br = (await call('GET', '/api/bridge')).json
  assert.equal(br.bridge.title, 'Escrever relatório')
  assert.equal(br.bridge.nextStep, 'Abrir o arquivo')
  assert.equal(br.focus.title, 'Responder e-mails')
  // troca explícita com anotação
  await call('POST', `/api/focus/${f2.session.id}/finish`, { outcome: 'switch', note: 'faltam 3 e-mails', nextStep: 'Responder o do João' })
  br = (await call('GET', '/api/bridge')).json
  assert.equal(br.bridge.nextStep, 'Responder o do João')
  assert.equal(br.focus, null)
  assert.equal((await call('POST', `/api/bridge/${br.bridge.id}/resolve`)).status, 204)
  assert.equal((await call('POST', `/api/focus/${f2.session.id}/finish`, { outcome: 'x' })).status, 400)
  // concluir com "done" conclui a tarefa
  const f3 = (await call('POST', '/api/focus', { taskId: t.id })).json
  await call('POST', `/api/focus/${f3.session.id}/finish`, { outcome: 'done' })
  const done = (await call('GET', '/api/tasks?status=done')).json.tasks
  assert.ok(done.some((x: { title: string }) => x.title === 'Escrever relatório'))
})

test('API âncoras: checklist padrão, marcar e adicionar item', async () => {
  let { anchors } = (await call('GET', '/api/anchors')).json
  assert.deepEqual(anchors.map((a: { key: string }) => a.key), ['acordar', 'sair', 'chegar', 'dormir'])
  const item = anchors[1].items[0]
  anchors = (await call('PUT', `/api/anchor-items/${item.id}/check`, { done: true })).json.anchors
  assert.equal(anchors[1].items[0].done, true)
  assert.equal((await call('GET', '/api/anchors?date=2026-10-19')).json.anchors[1].items[0].done, false) // por dia
  assert.equal((await call('POST', `/api/anchors/${anchors[1].id}/items`, { text: 'Marmita' })).status, 201)
  assert.equal((await call('POST', '/api/anchors/99/items', { text: 'x' })).status, 404)
})

test('API plano, revisão e configurações', async () => {
  await call('POST', '/api/tasks', { title: 'Etiquetar pedido', estMinutes: 20 })
  const plan = (await call('GET', '/api/plan')).json
  assert.ok(plan.blocks.some((b: { title: string }) => b.title === 'Etiquetar pedido'))
  const rv = (await call('GET', '/api/review/daily')).json
  assert.ok(rv.done.includes('Tomar remédio'))
  assert.ok(rv.pending >= 1)
  const g = (await call('PUT', '/api/settings/general', { dnd: true, shift: { enabled: true, anchorDate: '2026-10-20' } })).json
  assert.equal(g.dnd, true)
  assert.equal(g.shift.offDays, 3)
  assert.equal((await call('PUT', '/api/settings/general', { quietStart: '25:00' })).status, 400)
  assert.equal((await call('PUT', '/api/settings/general', { shift: { enabled: true, anchorDate: null } })).status, 400)
  assert.equal((await call('GET', '/api/plan')).json.workDay, true)
  await call('PUT', '/api/settings/general', { dnd: false })
})

// ------------------------------------------------------------------ pedidos e conteúdo
test('pedido só com data avisa às 09:00 do dia anterior e do dia da entrega', () => {
  const pedido = task({ id: 7, title: 'Pedido · Maria — gato', dueAt: '2026-10-21', category: 'pedido', insistence: 'max' })
  const at = (date: string, time: string) => ({ date, time })
  assert.equal(computeAlerts([pedido], at('2026-10-20', '08:00'), G, new Map()).length, 0)
  const d1 = computeAlerts([pedido], at('2026-10-20', '09:02'), G, new Map())
  assert.equal(d1.length, 1)
  assert.match(d1[0].title, /Entrega amanhã/)
  assert.equal(d1[0].level, 1)
  const d0 = computeAlerts([pedido], at('2026-10-21', '09:00'), G, new Map())
  assert.match(d0[0].title, /Entrega hoje/)
  assert.notEqual(d1[0].key, d0[0].key)
  // tarefa comum com só data continua sem alerta
  assert.equal(computeAlerts([task({ dueAt: '2026-10-21' })], at('2026-10-21', '09:10'), G, new Map()).length, 0)
})

test('API conteúdo: ideias, calendário, etapas e lembrete de constância', async () => {
  const idea = (await call('POST', '/api/content', { title: 'Reel: chaveiro de pet', product: 'chaveiro', kind: 'reel' })).json
  assert.equal(idea.date, null)
  const planned = (await call('POST', '/api/content', { title: 'Bastidores da impressão', date: '2026-10-20' })).json // terça
  let list = (await call('GET', '/api/content')).json
  assert.equal(list.ideas.length, 1)
  assert.equal(list.posts.length, 1)
  // terça (2) não é dia de postagem padrão (seg/qua/sex)
  assert.equal((await call('GET', '/api/content/today')).json.postingDay, false)
  await call('PUT', '/api/settings/general', { content: { days: [2] } })
  let td = (await call('GET', '/api/content/today')).json
  assert.equal(td.postingDay, true)
  assert.equal(td.pending, true)
  assert.equal(td.post.title, 'Bastidores da impressão')
  assert.equal(td.remindNow, true) // 15:00 >= 10:00
  // agendar a ideia e concluir etapas
  assert.equal((await call('PATCH', `/api/content/${idea.id}`, { date: '2026-10-22' })).json.date, '2026-10-22')
  let p = (await call('PUT', `/api/content/${planned.id}/steps`, { step: 'gravacao', done: true })).json
  assert.deepEqual(p.steps, ['gravacao'])
  p = (await call('PUT', `/api/content/${planned.id}/steps`, { step: 'roteiro', done: true })).json
  assert.deepEqual(p.steps, ['roteiro', 'gravacao']) // ordem da produção
  assert.equal(p.posted, false)
  p = (await call('PUT', `/api/content/${planned.id}/steps`, { step: 'postado', done: true })).json
  assert.equal(p.posted, true)
  td = (await call('GET', '/api/content/today')).json
  assert.equal(td.pending, false) // já postou hoje
  assert.equal((await call('PUT', `/api/content/${planned.id}/steps`, { step: 'x', done: true })).status, 400)
  assert.equal((await call('PUT', '/api/settings/general', { content: { days: [9] } })).status, 400)
  assert.equal((await call('DELETE', `/api/content/${idea.id}`)).status, 204)
  assert.equal((await call('DELETE', '/api/content/999')).status, 404)
  list = (await call('GET', '/api/content')).json
  assert.equal(list.ideas.length, 0)
})
