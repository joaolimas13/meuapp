import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import type { AddressInfo } from 'node:net'
import type { FastifyInstance } from 'fastify'
import { GeminiProvider } from '../src/ai/gemini'
import { MockProvider } from '../src/ai/mock'
import { loadConfig } from '../src/config'
import { openDb } from '../src/db'
import { buildServer } from '../src/server'

// Relógio fixo: terça-feira 20/10/2026, 15:00 em São Paulo.
const NOW = new Date('2026-10-20T18:00:00Z')
const config = { ...loadConfig({ AI_PROVIDER: 'mock' }), staticDir: '/nao-existe' }

let app: FastifyInstance
let base: string
before(async () => {
  app = buildServer({ config, provider: new MockProvider(1), db: openDb(':memory:'), now: () => NOW })
  await app.listen({ port: 0, host: '127.0.0.1' })
  base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`
})
after(() => app.close())

const call = async (method: string, path: string, body?: unknown) => {
  const res = await fetch(base + path, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  return { status: res.status, json: text && res.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text }
}
const chatEvents = async (message: string) => {
  const res = await fetch(`${base}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message }) })
  return (await res.text()).split('\n\n').filter(Boolean).map((l) => JSON.parse(l.replace(/^data: /, '')))
}

test('tarefas: criar com passos, ver em /today, concluir passo a passo', async () => {
  const r = await call('POST', '/api/tasks', { title: 'Arrumar a garagem', dueAt: '2026-10-20T17:00', steps: [{ title: 'Separar o lixo', minutes: 10 }, { title: 'Varrer', minutes: 10 }] })
  assert.equal(r.status, 201)
  const task = r.json
  assert.equal(task.steps.length, 2)

  const today = (await call('GET', '/api/today')).json
  assert.equal(today.date, '2026-10-20')
  assert.equal(today.time, '15:00')
  assert.equal(today.nextEvent.title, 'Arrumar a garagem')

  const c1 = (await call('POST', `/api/tasks/${task.steps[0].id}/complete`)).json
  assert.equal(c1.parentDone, null)
  const c2 = (await call('POST', `/api/tasks/${task.steps[1].id}/complete`)).json
  assert.equal(c2.parentDone.id, task.id)
  assert.equal((await call('GET', '/api/tasks?status=done')).json.tasks.length, 1)
})

test('tarefas: validação devolve 400 em português e 404 quando não existe', async () => {
  const bad = await call('POST', '/api/tasks', { title: 'x', dueAt: 'amanhã' })
  assert.equal(bad.status, 400)
  assert.match(bad.json.error, /dueAt/)
  assert.equal((await call('POST', '/api/tasks', {})).status, 400)
  assert.equal((await call('POST', '/api/tasks/999/complete')).status, 404)
  assert.equal((await call('DELETE', '/api/tasks/999')).status, 404)
})

test('caixa: captura rápida, sugestão por regras e aprovação em tarefa e memória', async () => {
  const a = (await call('POST', '/api/inbox', { text: 'ligar para o dentista amanhã às 10h' })).json
  const b = (await call('POST', '/api/inbox', { text: 'ideia: brinde de chaveiro para eventos' })).json
  assert.equal((await call('GET', '/api/inbox')).json.items.length, 2)

  const sug = (await call('POST', '/api/inbox/suggest')).json.suggestions
  const sa = sug.find((x: { id: number }) => x.id === a.id)
  const sb = sug.find((x: { id: number }) => x.id === b.id)
  assert.equal(sa.kind, 'task')
  assert.equal(sa.dueAt, '2026-10-21T10:00')
  assert.equal(sb.kind, 'memory')
  assert.equal(sb.category, 'ideias')

  const t = (await call('POST', `/api/inbox/${a.id}/accept`, { kind: 'task', title: sa.title, dueAt: sa.dueAt })).json
  assert.equal(t.kind, 'task')
  await call('POST', `/api/inbox/${b.id}/accept`, { kind: 'memory', title: sb.title, category: 'ideias' })
  assert.equal((await call('GET', '/api/inbox')).json.items.length, 0)
  assert.equal((await call('POST', `/api/inbox/${a.id}/accept`, { kind: 'task' })).status, 404) // já aprovada
})

test('memórias: criar, buscar, editar, exportar e apagar', async () => {
  const m = (await call('POST', '/api/memories', { text: 'Minha filha nasceu em 2024', category: 'pessoas', importance: 5 })).json
  assert.equal((await call('GET', '/api/memories?q=filha')).json.memories.length, 1)
  assert.equal((await call('GET', '/api/memories?q=xablau')).json.memories.length, 0)
  const up = (await call('PATCH', `/api/memories/${m.id}`, { text: 'Minha filha nasceu em 2023' })).json
  assert.match(up.text, /2023/)
  const md = await call('GET', '/api/memories/export?format=md')
  assert.match(md.json, /Minha filha nasceu em 2023/)
  const js = await call('GET', '/api/memories/export?format=json')
  assert.equal(js.json.memories.length >= 1, true)
  assert.equal((await call('DELETE', `/api/memories/${m.id}`)).status, 204)
  assert.equal((await call('POST', '/api/memories', { text: 'x', category: 'invalida' })).status, 400)
})

test('evolução: registrar o dia, metas fixas e diárias, nota e total de páginas', async () => {
  const g = (await call('POST', '/api/dev/goals', { title: 'Treinar', kind: 'fixed' })).json
  assert.equal(g.goals.length, 2) // água automática + Treinar
  const goalId = g.goals.find((x: { kind: string }) => x.kind === 'fixed').id
  await call('POST', '/api/dev/goals', { title: 'Enviar orçamento', kind: 'daily' })

  await call('PUT', '/api/dev/day/2026-10-20', { sleepHours: 8, pages: 30, waterL: 2, exercised: true, studied: true })
  const day = (await call('PUT', `/api/dev/goals/${goalId}/check`, { date: '2026-10-20', done: true })).json
  // metas: água + Treinar feitas, orçamento não = 2/3*40=26,7 · sono 20 · exercício 15 · estudo 15 · leitura 10 => 87
  assert.equal(day.score.total, 87)
  assert.equal(day.stats.pagesTotal, 30)
  assert.equal(day.stats.last7.length, 7)

  // atualizar só um campo não apaga os outros
  const day2 = (await call('PUT', '/api/dev/day/2026-10-20', { pages: 45 })).json
  assert.equal(day2.log.sleepHours, 8)
  assert.equal(day2.stats.pagesTotal, 45)

  assert.equal((await call('PUT', '/api/dev/day/2026-10-20', { sleepHours: 99 })).status, 400)
  const st = (await call('PUT', '/api/dev/settings', { targets: { pages: 40 } })).json
  assert.equal(st.targets.pages, 40)
  assert.equal(st.targets.sleepHours, 8)
})

test('chat com ferramentas (mock): cria tarefa, emite ação e a tarefa aparece na lista', async () => {
  const evs = await chatEvents('/tarefa Comprar filamento PETG')
  const action = evs.find((e) => e.type === 'action')
  assert.deepEqual(action, { type: 'action', ok: true, text: 'Tarefa criada: Comprar filamento PETG' })
  assert.equal(evs.at(-1).type, 'done')
  assert.equal(evs.at(-1).actions, 1)
  const tasks = (await call('GET', '/api/tasks')).json.tasks
  assert.ok(tasks.some((t: { title: string }) => t.title === 'Comprar filamento PETG'))
})

test('chat com ferramentas (mock): passos, memória e captura rápida', async () => {
  await chatEvents('/passos Organizar o ateliê')
  const t = (await call('GET', '/api/tasks')).json.tasks.find((x: { title: string }) => x.title === 'Organizar o ateliê')
  assert.equal(t.steps.length, 3)

  const mem = await chatEvents('/memoria Prefiro treinar de manhã')
  assert.equal(mem.find((e) => e.type === 'action').text, 'Memória salva')
  const inbox = await chatEvents('/anota ideia de brinde')
  assert.equal(inbox.find((e) => e.type === 'action').text, 'Anotado na Caixa de Entrada')
  assert.ok((await call('GET', '/api/inbox')).json.items.some((i: { text: string }) => i.text === 'ideia de brinde'))
})

test('Gemini + ferramentas: ida e volta devolve a assinatura e a resposta da ferramenta', async () => {
  const bodies: { contents: { role: string; parts: Record<string, unknown>[] }[] }[] = []
  const enc = new TextEncoder()
  const sseBody = (obj: object) => new Response(new ReadableStream({ start(c) { c.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`)); c.close() } }), { status: 200 })
  let n = 0
  const fake = (async (_u: string, init: RequestInit) => {
    bodies.push(JSON.parse(init.body as string))
    n++
    return n === 1
      ? sseBody({ candidates: [{ content: { parts: [{ functionCall: { name: 'save_memory', args: { text: 'Gosto de café sem açúcar', category: 'preferencias' } }, thoughtSignature: 'SIG123' }] } }] })
      : sseBody({ candidates: [{ content: { parts: [{ text: 'Guardado, JP.' }] } }] })
  }) as unknown as typeof fetch

  const a2 = buildServer({ config, provider: new GeminiProvider({ apiKey: 'k', model: 'm', fetchImpl: fake }), db: openDb(':memory:'), now: () => NOW })
  await a2.listen({ port: 0, host: '127.0.0.1' })
  try {
    const b2 = `http://127.0.0.1:${(a2.server.address() as AddressInfo).port}`
    const res = await fetch(`${b2}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'lembra que gosto de café sem açúcar' }) })
    const evs = (await res.text()).split('\n\n').filter(Boolean).map((l) => JSON.parse(l.replace(/^data: /, '')))
    assert.deepEqual(evs.map((e) => e.type), ['action', 'delta', 'done'])
    assert.equal(bodies.length, 2)
    const second = bodies[1].contents
    assert.deepEqual(second.map((c) => c.role), ['user', 'model', 'user'])
    assert.equal(second[1].parts[0].thoughtSignature, 'SIG123')
    assert.deepEqual(second[2].parts[0], { functionResponse: { name: 'save_memory', response: { ok: true, id: 1 } } })
    assert.ok(bodies[0].contents.length === 1)
  } finally {
    await a2.close()
  }
})

test('ferramenta com argumento inválido devolve erro à IA, sem derrubar a conversa', async () => {
  const evs = await chatEvents('/tarefa    ')
  assert.equal(evs.at(-1).type === 'done' || evs.at(-1).type === 'error', true)
})
