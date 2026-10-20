import {
  AIError,
  normalizeTurns,
  type AIEvent,
  type AIProvider,
  type ChatRequest,
  type ChatTurn,
  type ToolCall,
} from './types'

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

interface GeminiPart {
  text?: string
  thought?: boolean
  functionCall?: { name: string; args?: Record<string, unknown> }
  /** Assinatura de raciocínio: o Gemini 3 exige devolvê-la junto da chamada de ferramenta. */
  thoughtSignature?: string
}
interface GeminiChunk {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[]
  promptFeedback?: { blockReason?: string }
}

/**
 * Lê o corpo SSE do Gemini (linhas "data: {json}") e devolve eventos: textos
 * e, no fim, os pedidos de ferramenta (se houver). As partes originais ficam em
 * `raw` para serem devolvidas intactas na próxima chamada.
 * Separada da classe para poder ser testada sem internet.
 */
export async function* parseGeminiSse(body: ReadableStream<Uint8Array>): AsyncGenerator<AIEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const calls: ToolCall[] = []
  const allParts: GeminiPart[] = []

  // Processa uma linha e devolve os textos que ela trouxe.
  const handleLine = (line: string): string[] => {
    if (!line.startsWith('data:')) return []
    const json = line.slice(5).trim()
    if (!json || json === '[DONE]') return []
    let chunk: GeminiChunk
    try {
      chunk = JSON.parse(json) as GeminiChunk
    } catch {
      return [] // linha incompleta/estranha: ignora
    }
    if (chunk.promptFeedback?.blockReason) {
      throw new AIError('O Gemini bloqueou este pedido. Tente reformular.', 'bad_response')
    }
    const texts: string[] = []
    for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
      // "thought" = raciocínio interno do modelo; não mostramos.
      if (part.thought) continue
      if (part.functionCall) calls.push({ name: part.functionCall.name, args: part.functionCall.args ?? {} })
      if (part.text) texts.push(part.text)
      if (part.text || part.functionCall || part.thoughtSignature) allParts.push(part)
    }
    return texts
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() ?? '' // a última pode estar incompleta
      for (const line of lines) for (const text of handleLine(line)) yield { type: 'text', text }
    }
    buffer += decoder.decode()
    for (const text of handleLine(buffer)) yield { type: 'text', text }
    if (calls.length > 0) yield { type: 'tool_calls', calls, raw: { parts: allParts } }
  } finally {
    reader.releaseLock()
  }
}

/** Converte nossa conversa no formato do Gemini (a IA se chama "model"; ferramentas voltam como "user"). */
export function toGeminiContents(turns: ChatTurn[]) {
  return normalizeTurns(turns).map((t) => {
    if (t.role === 'user') return { role: 'user', parts: [{ text: t.content }] }
    if (t.role === 'tool') {
      return {
        role: 'user',
        parts: t.results.map((r) => ({
          functionResponse: {
            name: r.name,
            response: r.response && typeof r.response === 'object' && !Array.isArray(r.response) ? r.response : { result: r.response },
          },
        })),
      }
    }
    const raw = t.raw as { parts?: GeminiPart[] } | undefined
    if (raw?.parts) return { role: 'model', parts: raw.parts }
    return {
      role: 'model',
      parts: [
        ...(t.content ? [{ text: t.content }] : []),
        ...(t.toolCalls ?? []).map((c) => ({ functionCall: { name: c.name, args: c.args } })),
      ],
    }
  })
}

function errorForStatus(status: number): AIError {
  if (status === 400 || status === 401 || status === 403) {
    return new AIError(
      'O Gemini recusou o pedido (chave inválida ou pedido mal formado). Confira a GEMINI_API_KEY no backend/.env.',
      'auth',
    )
  }
  if (status === 404) {
    return new AIError(
      'Modelo do Gemini não encontrado. Ajuste GEMINI_MODEL no backend/.env (lista em ai.google.dev/models).',
      'model',
    )
  }
  if (status === 429) {
    return new AIError('Limite de uso do Gemini atingido. Aguarde um pouco e tente de novo.', 'rate_limit')
  }
  return new AIError(`O Gemini respondeu com erro (${status}). Tente de novo em instantes.`, 'bad_response')
}

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini'
  readonly model: string
  private readonly apiKey: string
  private readonly fetchImpl: typeof fetch

  constructor(opts: { apiKey: string; model: string; fetchImpl?: typeof fetch }) {
    this.apiKey = opts.apiKey
    this.model = opts.model
    this.fetchImpl = opts.fetchImpl ?? fetch
  }

  isConfigured() {
    return this.apiKey.length > 0
  }

  async *streamChat({ system, messages, tools, signal }: ChatRequest): AsyncGenerator<AIEvent> {
    if (!this.isConfigured()) {
      throw new AIError('Falta a chave do Gemini. Coloque GEMINI_API_KEY no arquivo backend/.env.', 'not_configured')
    }

    const body = {
      systemInstruction: { parts: [{ text: system }] },
      contents: toGeminiContents(messages),
      ...(tools?.length ? { tools: [{ functionDeclarations: tools }] } : {}),
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
    }

    let res: Response
    try {
      res = await this.fetchImpl(
        `${BASE_URL}/models/${encodeURIComponent(this.model)}:streamGenerateContent?alt=sse`,
        {
          method: 'POST',
          // A chave vai no cabeçalho, nunca na URL (URLs aparecem em logs).
          headers: { 'content-type': 'application/json', 'x-goog-api-key': this.apiKey },
          body: JSON.stringify(body),
          signal,
        },
      )
    } catch (err) {
      if (signal?.aborted) throw err
      throw new AIError('Sem conexão com o Gemini. Verifique a internet.', 'network')
    }

    if (!res.ok || !res.body) throw errorForStatus(res.status)
    yield* parseGeminiSse(res.body)
  }
}
