import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AIError, normalizeTurns } from '../src/ai/types'
import { GeminiProvider, parseGeminiSse, toGeminiContents } from '../src/ai/gemini'

const enc = new TextEncoder()
const streamOf = (chunks: string[]) =>
  new ReadableStream<Uint8Array>({
    start(c) {
      chunks.forEach((x) => c.enqueue(enc.encode(x)))
      c.close()
    },
  })
import type { AIEvent } from '../src/ai/types'
const events = async (g: AsyncGenerator<AIEvent>) => {
  const out: AIEvent[] = []
  for await (const e of g) out.push(e)
  return out
}
/** Só o texto, juntando os pedaços. */
const collect = async (g: AsyncGenerator<AIEvent>) =>
  (await events(g)).map((e) => (e.type === 'text' ? e.text : '')).join('')
const sse = (text: string, extra: object = {}) =>
  `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }], ...extra })}\n\n`

test('parseGeminiSse junta os pedaços de texto', async () => {
  const out = await collect(parseGeminiSse(streamOf([sse('Olá, '), sse('JP!')])))
  assert.equal(out, 'Olá, JP!')
})

test('parseGeminiSse aguenta um evento cortado no meio entre dois pacotes', async () => {
  const full = sse('texto inteiro')
  const out = await collect(parseGeminiSse(streamOf([full.slice(0, 25), full.slice(25)])))
  assert.equal(out, 'texto inteiro')
})

test('parseGeminiSse ignora partes de raciocínio (thought)', async () => {
  const body = `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: 'pensando', thought: true }, { text: 'resposta' }] } }] })}\n\n`
  assert.equal(await collect(parseGeminiSse(streamOf([body]))), 'resposta')
})

test('parseGeminiSse erra com mensagem clara quando o pedido é bloqueado', async () => {
  const body = `data: ${JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' } })}\n\n`
  await assert.rejects(collect(parseGeminiSse(streamOf([body]))), (e: unknown) => e instanceof AIError && e.code === 'bad_response')
})

test('GeminiProvider sem chave falha antes de chamar a rede', async () => {
  let called = false
  const p = new GeminiProvider({ apiKey: '', model: 'm', fetchImpl: (async () => { called = true; return new Response('') }) as typeof fetch })
  await assert.rejects(collect(p.streamChat({ system: 's', messages: [{ role: 'user', content: 'oi' }] })), (e: unknown) => e instanceof AIError && e.code === 'not_configured')
  assert.equal(called, false)
})

test('GeminiProvider monta o pedido certo e manda a chave no cabeçalho, não na URL', async () => {
  let seenUrl = ''
  let seenInit: RequestInit | undefined
  const fake = (async (url: string, init: RequestInit) => {
    seenUrl = url
    seenInit = init
    return new Response(streamOf([sse('ok')]), { status: 200 })
  }) as unknown as typeof fetch
  const p = new GeminiProvider({ apiKey: 'CHAVE-FALSA', model: 'modelo-x', fetchImpl: fake })
  const out = await collect(p.streamChat({ system: 'SYS', messages: [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }, { role: 'user', content: 'c' }] }))
  assert.equal(out, 'ok')
  assert.match(seenUrl, /models\/modelo-x:streamGenerateContent\?alt=sse$/)
  assert.ok(!seenUrl.includes('CHAVE-FALSA'))
  assert.equal((seenInit!.headers as Record<string, string>)['x-goog-api-key'], 'CHAVE-FALSA')
  const sent = JSON.parse(seenInit!.body as string)
  assert.equal(sent.systemInstruction.parts[0].text, 'SYS')
  assert.deepEqual(sent.contents.map((c: { role: string }) => c.role), ['user', 'model', 'user'])
})

test('GeminiProvider traduz códigos HTTP em mensagens úteis', async () => {
  const cases: [number, string][] = [[403, 'auth'], [404, 'model'], [429, 'rate_limit'], [500, 'bad_response']]
  for (const [status, code] of cases) {
    const p = new GeminiProvider({ apiKey: 'k', model: 'm', fetchImpl: (async () => new Response('x', { status })) as typeof fetch })
    await assert.rejects(collect(p.streamChat({ system: '', messages: [{ role: 'user', content: 'oi' }] })), (e: unknown) => e instanceof AIError && e.code === code)
  }
})

test('GeminiProvider vira erro de rede quando o fetch falha', async () => {
  const p = new GeminiProvider({ apiKey: 'k', model: 'm', fetchImpl: (async () => { throw new TypeError('fetch failed') }) as typeof fetch })
  await assert.rejects(collect(p.streamChat({ system: '', messages: [{ role: 'user', content: 'oi' }] })), (e: unknown) => e instanceof AIError && e.code === 'network')
})

test('normalizeTurns junta turnos repetidos e começa pelo usuário', () => {
  const out = normalizeTurns([
    { role: 'assistant', content: 'sobra' },
    { role: 'user', content: 'a' },
    { role: 'user', content: 'b' },
    { role: 'assistant', content: 'c' },
  ])
  assert.deepEqual(out, [
    { role: 'user', content: 'a\n\nb' },
    { role: 'assistant', content: 'c' },
  ])
})

test('parseGeminiSse devolve pedidos de ferramenta com as partes originais (assinatura incluída)', async () => {
  const part = { functionCall: { name: 'create_task', args: { title: 'Dentista' } }, thoughtSignature: 'ASSINATURA' }
  const body = `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Criando. ' }, part] } }] })}\n\n`
  const evs = await events(parseGeminiSse(streamOf([body])))
  assert.deepEqual(evs[0], { type: 'text', text: 'Criando. ' })
  const call = evs[1]
  assert.equal(call.type, 'tool_calls')
  if (call.type === 'tool_calls') {
    assert.deepEqual(call.calls, [{ name: 'create_task', args: { title: 'Dentista' } }])
    assert.equal((call.raw as { parts: { thoughtSignature?: string }[] }).parts[1].thoughtSignature, 'ASSINATURA')
  }
})

test('toGeminiContents devolve a chamada com a assinatura e a resposta da ferramenta como "user"', () => {
  const raw = { parts: [{ functionCall: { name: 'save_memory', args: { text: 'x' } }, thoughtSignature: 'SIG' }] }
  const contents = toGeminiContents([
    { role: 'user', content: 'guarda x' },
    { role: 'assistant', content: '', toolCalls: [{ name: 'save_memory', args: { text: 'x' } }], raw },
    { role: 'tool', results: [{ name: 'save_memory', response: { ok: true } }] },
  ])
  assert.deepEqual(contents.map((c) => c.role), ['user', 'model', 'user'])
  assert.deepEqual(contents[1].parts, raw.parts)
  assert.deepEqual(contents[2].parts, [{ functionResponse: { name: 'save_memory', response: { ok: true } } }])
})

test('GeminiProvider envia as ferramentas disponíveis no pedido', async () => {
  let sent: { tools?: { functionDeclarations: { name: string }[] }[] } = {}
  const fake = (async (_u: string, init: RequestInit) => {
    sent = JSON.parse(init.body as string)
    return new Response(streamOf([sse('ok')]), { status: 200 })
  }) as unknown as typeof fetch
  const p = new GeminiProvider({ apiKey: 'k', model: 'm', fetchImpl: fake })
  await collect(p.streamChat({ system: '', messages: [{ role: 'user', content: 'oi' }], tools: [{ name: 't1', description: 'd', parameters: { type: 'object', properties: {} } }] }))
  assert.equal(sent.tools?.[0].functionDeclarations[0].name, 't1')
})
