import type { FastifyInstance } from 'fastify'
import type { TrainingEntry, VaultStatus } from '../../../shared/types'
import { addDays } from '../lib/time'
import { asObj, BadRequest, optEnum, optNum, optStr, parseId, reqStr } from '../lib/validate'
import type { Services } from '../services'
import { checkinSummary, reviewCard, weeklyReview, wellbeingSummary } from '../wellbeing'

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/
const RESULTS = ['wrong', 'hard', 'right'] as const
const VAULT_STATUS = ['guardada', 'executar', 'adiada', 'descartada'] as const

/** Rotas da Fase 7: check-in, estudos, treino, cofre, sequências e revisão semanal. */
export function wellbeingRoutes(app: FastifyInstance, s: Services) {
  // ---------------------------------------------------------------- check-in de energia e humor
  const summary = () => {
    const now = s.local()
    return checkinSummary(s.wellbeing.checkinsBetween(addDays(now.date, -60), now.date), now)
  }
  app.get('/api/checkins/summary', async () => summary())
  app.post('/api/checkins', async (req, reply) => {
    const b = asObj(req.body)
    const energy = optNum(b, 'energy', 1, 5)
    const mood = optNum(b, 'mood', 1, 5)
    if (!Number.isInteger(energy) || !Number.isInteger(mood)) throw new BadRequest('Informe energia e humor de 1 a 5.')
    const now = s.local()
    s.wellbeing.addCheckin({ date: now.date, time: now.time, energy: energy!, mood: mood!, note: optStr(b, 'note', 200) ?? '' })
    return reply.code(201).send(summary())
  })

  // ---------------------------------------------------------------- estudos (revisão espaçada)
  const studyView = () => {
    const now = s.local()
    const goal = s.settings.general().study.weeklyHours
    const done = s.dev.repo.logsBetween(addDays(now.date, -6), now.date).reduce((a, l) => a + (l.studyHours ?? 0), 0)
    return {
      due: s.wellbeing.dueCards(now.date),
      dueCount: s.wellbeing.dueCount(now.date),
      total: s.wellbeing.totalCards(),
      weeklyHours: { goal, done: Math.round(done * 10) / 10 },
      topics: s.wellbeing.cardTopics(),
    }
  }
  app.get('/api/study', async () => studyView())
  app.post('/api/study/cards', async (req, reply) => {
    const b = asObj(req.body)
    s.wellbeing.addCard({ topic: optStr(b, 'topic', 80) ?? '', question: reqStr(b, 'question', 400), answer: reqStr(b, 'answer', 600) }, s.local().date)
    return reply.code(201).send(studyView())
  })
  app.post('/api/study/cards/:id/review', async (req, reply) => {
    const id = parseId((req.params as { id: string }).id)
    const result = optEnum(asObj(req.body), 'result', RESULTS)
    if (!result) throw new BadRequest('"result" deve ser: wrong, hard ou right.')
    const card = s.wellbeing.getCard(id)
    if (!card) return reply.code(404).send({ error: 'Cartão não encontrado.' })
    const r = reviewCard(card.box, result, s.local().date)
    s.wellbeing.setCardSchedule(id, r.box, r.next)
    return studyView()
  })
  app.delete('/api/study/cards/:id', async (req, reply) => {
    return s.wellbeing.deleteCard(parseId((req.params as { id: string }).id)) ? reply.code(204).send() : reply.code(404).send({ error: 'Cartão não encontrado.' })
  })

  // ---------------------------------------------------------------- plano de treino
  app.get('/api/training', async () => ({ plan: s.wellbeing.training() }))
  app.put('/api/training', async (req) => {
    const raw = asObj(req.body).plan
    if (!Array.isArray(raw) || raw.length > 21) throw new BadRequest('"plan" deve ser uma lista de até 21 treinos.')
    const plan: TrainingEntry[] = raw.map((e) => {
      const o = asObj(e)
      const weekday = optNum(o, 'weekday', 0, 6)
      const time = optStr(o, 'time', 5) ?? '18:00'
      if (!Number.isInteger(weekday) || !HHMM.test(time)) throw new BadRequest('Treino inválido: dia da semana (0 a 6) e horário HH:MM.')
      return { weekday: weekday!, title: reqStr(o, 'title', 100), time }
    })
    s.wellbeing.replaceTraining(plan)
    return { plan: s.wellbeing.training() }
  })

  // ---------------------------------------------------------------- cofre de ideias e projetos
  app.get('/api/vault', async () => ({ items: s.wellbeing.vault() }))
  app.post('/api/vault', async (req, reply) => {
    const b = asObj(req.body)
    const item = s.wellbeing.addVault({ title: reqStr(b, 'title', 200), notes: optStr(b, 'notes', 1000) ?? '', kind: optEnum(b, 'kind', ['ideia', 'projeto'] as const) ?? 'ideia' })
    return reply.code(201).send(item)
  })
  app.patch('/api/vault/:id', async (req, reply) => {
    const id = parseId((req.params as { id: string }).id)
    const item = s.wellbeing.getVault(id)
    if (!item) return reply.code(404).send({ error: 'Item não encontrado.' })
    const status = optEnum(asObj(req.body), 'status', VAULT_STATUS) as VaultStatus | undefined
    if (!status) throw new BadRequest('"status" deve ser: ' + VAULT_STATUS.join(', ') + '.')
    s.wellbeing.setVaultStatus(id, status)
    // "Executar" vira uma tarefa na lista, para não ficar só na intenção.
    if (status === 'executar' && item.status !== 'executar') s.tasks.create({ title: item.title, description: item.notes, category: 'projeto' })
    return reply.send({ items: s.wellbeing.vault() })
  })

  // ---------------------------------------------------------------- sequências e revisão semanal
  app.get('/api/wellbeing/summary', async () => wellbeingSummary(s))
  app.get('/api/review/weekly', async () => weeklyReview(s))
}
