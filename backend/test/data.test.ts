import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DevRepo, emptyLog } from '../src/db/devRepo'
import { openDb } from '../src/db'
import { InboxRepo } from '../src/db/inboxRepo'
import { MemoriesRepo } from '../src/db/memoriesRepo'
import { TasksRepo } from '../src/db/tasksRepo'
import { computeScore, DEFAULT_TARGETS, DEFAULT_WEIGHTS, levelOf, streak } from '../src/dev/score'
import { DevService } from '../src/dev/service'
import { addDays, isDue, localNow } from '../src/lib/time'
import { buildToday } from '../src/planner'

const fresh = () => {
  const db = openDb(':memory:')
  return { db, tasks: new TasksRepo(db), memories: new MemoriesRepo(db), inbox: new InboxRepo(db), dev: new DevRepo(db) }
}

// ------------------------------------------------------------ pontuação

test('pontuação: dia perfeito vale 100', () => {
  const log = { ...emptyLog('2026-10-20'), exercised: true, studied: true, pages: 30, sleepHours: 8, waterL: 2 }
  const s = computeScore({ log, goals: { done: 3, total: 3 } }, DEFAULT_TARGETS, DEFAULT_WEIGHTS)
  assert.equal(s.total, 100)
})

test('pontuação: dia sem registro vale 0, nunca negativo', () => {
  const s = computeScore({ log: emptyLog('2026-10-20'), goals: { done: 0, total: 2 } }, DEFAULT_TARGETS, DEFAULT_WEIGHTS)
  assert.equal(s.total, 0)
})

test('pontuação: sono cheio a partir de 7h, proporcional abaixo e sem penalizar dormir mais', () => {
  const at = (h: number) =>
    computeScore({ log: { ...emptyLog('d'), sleepHours: h }, goals: { done: 0, total: 1 } }, DEFAULT_TARGETS, DEFAULT_WEIGHTS).parts.sleep
  assert.equal(at(7), 20)
  assert.equal(at(8), 20)
  assert.equal(at(10), 20)
  assert.equal(at(3.5), 10)
})

test('pontuação: leitura é proporcional à meta de páginas e limitada a 10', () => {
  const at = (p: number) =>
    computeScore({ log: { ...emptyLog('d'), pages: p }, goals: { done: 0, total: 1 } }, DEFAULT_TARGETS, DEFAULT_WEIGHTS).parts.reading
  assert.equal(at(15), 5)
  assert.equal(at(90), 10)
})

test('sequência: hoje ainda em andamento não quebra a sequência', () => {
  const m = new Map([['2026-10-18', 80], ['2026-10-19', 70], ['2026-10-20', 10]])
  assert.equal(streak(m, '2026-10-20', addDays), 2)
  m.set('2026-10-20', 65)
  assert.equal(streak(m, '2026-10-20', addDays), 3)
  m.set('2026-10-19', 20) // dia fraco quebra
  assert.equal(streak(m, '2026-10-20', addDays), 1)
})

test('nível: 500 pontos por nível', () => {
  assert.deepEqual(levelOf(0), { level: 1, xpInLevel: 0, xpPerLevel: 500 })
  assert.deepEqual(levelOf(1230), { level: 3, xpInLevel: 230, xpPerLevel: 500 })
})

// ------------------------------------------------------------ serviço de evolução

test('evolução: água entra como meta automática e metas fixas valem nos dias seguintes', () => {
  const { dev } = fresh()
  const svc = new DevService(dev)
  const g = dev.addGoal({ title: 'Treinar', kind: 'fixed', createdOn: '2026-10-19' })
  dev.saveLog('2026-10-20', { waterL: 2.5, pages: 30, sleepHours: 8 })

  const day = svc.day('2026-10-20', '2026-10-20')
  assert.deepEqual(day.goals.map((x) => [x.title.startsWith('Beber'), x.done]), [[true, true], [false, false]])
  dev.setCheck(g.id, '2026-10-20', true)
  // metas 2/2 = 40, sono 20, leitura 10 => 70
  assert.equal(svc.day('2026-10-20', '2026-10-20').score.total, 70)
  // a meta fixa não vale antes de ser criada
  assert.equal(svc.day('2026-10-18', '2026-10-20').goals.length, 1)
})

test('evolução: encerrar meta fixa não muda o passado', () => {
  const { dev } = fresh()
  const g = dev.addGoal({ title: 'Alongar', kind: 'fixed', createdOn: '2026-10-01' })
  dev.removeGoal(g.id, '2026-10-20')
  assert.equal(dev.goalsFor('2026-10-10').length, 1)
  assert.equal(dev.goalsFor('2026-10-20').length, 0)
})

test('evolução: total de páginas do período, do mês e sequência por estatísticas', () => {
  const { dev } = fresh()
  const svc = new DevService(dev)
  dev.saveLog('2026-09-30', { pages: 40 })
  dev.saveLog('2026-10-19', { pages: 30, exercised: true, studied: true, sleepHours: 8, waterL: 2 }) // 40+... dia bom
  dev.saveLog('2026-10-20', { pages: 25 })
  const s = svc.stats('2026-10-20')
  assert.equal(s.pagesTotal, 95)
  assert.equal(s.pagesMonth, 55)
  assert.equal(s.last7.length, 7)
  assert.equal(s.streak, 1)
})

test('configurações: metas editáveis e persistentes', () => {
  const { dev } = fresh()
  dev.saveTargets({ pages: 50 })
  assert.equal(dev.targets().pages, 50)
  assert.equal(dev.targets().sleepHours, 8)
})

// ------------------------------------------------------------ tarefas

test('tarefas: criar com passos e concluir passo a passo fecha a principal no fim', () => {
  const { tasks } = fresh()
  const t = tasks.create({ title: 'Arrumar a garagem', dueAt: '2026-10-21' })
  tasks.addSteps(t.id, [{ title: 'Separar o lixo', minutes: 10 }, { title: 'Varrer', minutes: 10 }])
  const full = tasks.get(t.id)!
  assert.deepEqual(full.steps.map((s) => s.title), ['Separar o lixo', 'Varrer'])

  const r1 = tasks.complete(full.steps[0].id)!
  assert.equal(r1.parentDone, null)
  const r2 = tasks.complete(full.steps[1].id)!
  assert.equal(r2.parentDone?.id, t.id)
  assert.equal(tasks.get(t.id)!.status, 'done')
  assert.ok(tasks.get(t.id)!.completedAt)
})

test('tarefas: apagar a principal apaga os passos; lista não mostra passos soltos', () => {
  const { tasks } = fresh()
  const t = tasks.create({ title: 'A' })
  tasks.addSteps(t.id, [{ title: 'p1' }])
  assert.equal(tasks.list().length, 1)
  assert.ok(tasks.delete(t.id))
  assert.equal(tasks.list({ status: 'all' }).length, 0)
})

test('tarefas: reabrir limpa a data de conclusão', () => {
  const { tasks } = fresh()
  const t = tasks.create({ title: 'X' })
  tasks.update(t.id, { status: 'done' })
  assert.ok(tasks.get(t.id)!.completedAt)
  tasks.update(t.id, { status: 'todo' })
  assert.equal(tasks.get(t.id)!.completedAt, null)
})

test('visão de hoje: no máximo 3 prioridades, atrasadas separadas, próximo compromisso com horário', () => {
  const { tasks } = fresh()
  const now = localNow('America/Sao_Paulo', new Date('2026-10-20T18:00:00Z')) // 15:00 em SP
  assert.deepEqual(now, { date: '2026-10-20', time: '15:00' })
  tasks.create({ title: 'ontem', dueAt: '2026-10-19' })
  tasks.create({ title: 'hoje 14h (passou)', dueAt: '2026-10-20T14:00' })
  tasks.create({ title: 'hoje 16h', dueAt: '2026-10-20T16:00' })
  tasks.create({ title: 'hoje sem hora', dueAt: '2026-10-20', priority: 'high' })
  tasks.create({ title: 'sem data' })
  tasks.create({ title: 'sem data 2' })
  tasks.create({ title: 'amanhã', dueAt: '2026-10-21' })

  const v = buildToday(tasks.list(), now)
  assert.equal(v.priorities.length, 3)
  assert.equal(v.priorities[0].title, 'hoje sem hora') // alta prioridade primeiro
  assert.deepEqual(v.overdue.map((t) => t.title), ['ontem', 'hoje 14h (passou)'])
  assert.equal(v.nextEvent?.title, 'hoje 16h')
  assert.ok(!v.priorities.some((t) => t.title === 'amanhã'))
})

test('datas: validação de prazo', () => {
  assert.ok(isDue('2026-10-20'))
  assert.ok(isDue('2026-10-20T09:30'))
  assert.ok(!isDue('2026-13-40'))
  assert.ok(!isDue('amanhã'))
  assert.ok(!isDue('2026-10-20T25:00'))
})

// ------------------------------------------------------------ memórias e caixa

test('memórias: busca ignora acento e maiúscula, e prioriza o que combina mais', () => {
  const { memories } = fresh()
  memories.add({ text: 'Minha esposa faz aniversário em março', category: 'pessoas', importance: 4 })
  memories.add({ text: 'Prefiro respostas curtas', category: 'preferencias' })
  memories.add({ text: 'Filamento PETG branco acabando', category: 'projetos' })
  const r = memories.search('quando é o ANIVERSÁRIO da esposa?')
  assert.equal(r[0].category, 'pessoas')
  assert.equal(memories.search('xablau').length, 0)
  assert.equal(memories.search('filamento', { category: 'pessoas' }).length, 0)
})

test('memórias: editar, apagar e exportar', () => {
  const { memories } = fresh()
  const m = memories.add({ text: 'a', category: 'inexistente', tags: ['x'] })
  assert.equal(m.category, 'notas') // categoria inválida cai em "notas"
  assert.equal(memories.update(m.id, { text: 'b', importance: 5 })!.text, 'b')
  assert.equal(memories.pinned().length, 1)
  assert.match(memories.toMarkdown(), /## notas[\s\S]*- b/)
  assert.ok(memories.delete(m.id))
  assert.equal(memories.get(m.id), null)
})

test('caixa de entrada: captura, lista pendentes e muda status', () => {
  const { inbox } = fresh()
  const a = inbox.add('ideia solta')
  inbox.add('outra')
  assert.equal(inbox.pending().length, 2)
  inbox.setStatus(a.id, 'done')
  assert.deepEqual(inbox.pending().map((i) => i.text), ['outra'])
})

test('banco: migrações são idempotentes (abrir de novo não quebra)', () => {
  const db = openDb(':memory:')
  assert.equal(db.pragma('user_version', { simple: true }), 3)
})
