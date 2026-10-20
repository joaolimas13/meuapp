import type { FastifyInstance } from 'fastify'
import { AIError, normalizeTurns, type ChatTurn, type ToolCall } from '../ai'
import { buildContextBlock, buildSystemPrompt } from '../ai/systemPrompt'
import type { Services } from '../services'
import { runTool, TOOL_DEFS } from '../tools'

const MAX_MESSAGE_CHARS = 4000
/** Quantas idas e vindas com ferramentas por resposta (evita laço infinito). */
const MAX_TOOL_ROUNDS = 5

export function chatRoutes(app: FastifyInstance, s: Services) {
  app.get('/api/chat/history', async () => ({ messages: s.chat.recent(200) }))

  app.delete('/api/chat/history', async (_req, reply) => {
    s.chat.clear()
    return reply.code(204).send()
  })

  // Envia uma mensagem e devolve a resposta em streaming (Server-Sent Events).
  // Cada evento é uma linha "data: {json}" com type = delta | action | done | error.
  app.post('/api/chat', async (req, reply) => {
    const body = req.body as { message?: unknown } | null
    const message = typeof body?.message === 'string' ? body.message.trim() : ''
    if (!message || message.length > MAX_MESSAGE_CHARS) {
      return reply.code(400).send({ error: `Mensagem vazia ou maior que ${MAX_MESSAGE_CHARS} caracteres.` })
    }

    s.chat.add('user', message)
    const history: ChatTurn[] = s.chat
      .recent(s.config.historyContext)
      .map((m) => (m.role === 'user' ? { role: 'user', content: m.content } : { role: 'assistant', content: m.content }))
    const convo = normalizeTurns(history)

    // O que o GAIA "sabe" agora: memórias fixas + as que combinam com a mensagem + tarefas em aberto.
    const local = s.local()
    const mem = new Map<number, ReturnType<typeof s.memories.get>>()
    for (const m of [...s.memories.pinned(5), ...s.memories.search(message, { limit: 6 })]) mem.set(m.id, m)
    const system =
      buildSystemPrompt({ userName: s.config.userName, now: s.now(), timezone: s.config.timezone }) +
      buildContextBlock({
        memories: [...mem.values()].filter((m): m is NonNullable<typeof m> => !!m),
        openTasks: s.tasks.list({ status: 'todo', limit: 25 }),
        now: local,
        userName: s.config.userName,
      })

    // Assumimos a resposta nós mesmos para poder enviar aos poucos.
    reply.hijack()
    const raw = reply.raw
    raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    const send = (event: object) => raw.write(`data: ${JSON.stringify(event)}\n\n`)

    // Se você fechar a página no meio, cancelamos a chamada à IA.
    const abort = new AbortController()
    raw.on('close', () => {
      if (!raw.writableFinished) abort.abort()
    })

    let answer = ''
    let actions = 0
    try {
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        let roundText = ''
        let calls: ToolCall[] = []
        let rawParts: unknown

        for await (const ev of s.provider.streamChat({ system, messages: convo, tools: TOOL_DEFS, signal: abort.signal })) {
          if (ev.type === 'text') {
            // Texto de uma nova rodada (depois de uma ação) começa em novo parágrafo.
            const piece = roundText === '' && answer !== '' ? `\n\n${ev.text}` : ev.text
            roundText += ev.text
            answer += piece
            send({ type: 'delta', text: piece })
          } else {
            calls = ev.calls
            rawParts = ev.raw
          }
        }
        if (calls.length === 0) break

        // A IA pediu ferramentas: executa, mostra cada ação na tela e devolve os resultados.
        convo.push({ role: 'assistant', content: roundText, toolCalls: calls, raw: rawParts })
        const results = calls.map((c) => {
          const out = runTool(c.name, c.args, s)
          if (out.action) {
            if (out.action.ok) actions++
            send({ type: 'action', ok: out.action.ok, text: out.action.text })
          }
          return { name: c.name, response: out.response }
        })
        convo.push({ role: 'tool', results })
      }

      // Se agiu mas a IA não escreveu nada, damos uma confirmação simples.
      if (!answer.trim() && actions > 0) {
        answer = 'Feito.'
        send({ type: 'delta', text: answer })
      }
      if (!answer.trim() && !abort.signal.aborted) {
        throw new AIError('A IA não devolveu nenhuma resposta. Tente de novo.', 'bad_response')
      }
      const saved = answer.trim() ? s.chat.add('assistant', answer) : null
      send({ type: 'done', id: saved?.id ?? null, actions })
    } catch (err) {
      if (answer.trim()) s.chat.add('assistant', answer) // guarda o que já chegou
      if (!abort.signal.aborted) {
        const known = err instanceof AIError
        if (!known) console.error('Erro inesperado no chat:', err instanceof Error ? err.message : err)
        send({
          type: 'error',
          code: known ? err.code : 'unknown',
          message: known ? err.message : 'Algo deu errado ao falar com a IA.',
          actions,
        })
      }
    } finally {
      raw.end()
    }
  })
}
