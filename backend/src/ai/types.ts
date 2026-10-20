/*
  CAMADA DE IA ISOLADA
  --------------------
  O resto do GAIA só conhece esta interface. Trocar de Gemini para Claude (ou
  outro) é criar uma nova classe que implemente AIProvider e registrá-la em
  ai/index.ts — nada mais muda.

  A IA devolve "eventos": pedaços de texto, ou pedidos para usar uma
  ferramenta (tool calling), como criar uma tarefa. Quem executa a ferramenta
  é o servidor (routes/chat.ts), e o resultado volta para a IA continuar.
*/

/** Descrição de uma ferramenta que a IA pode chamar. */
export interface ToolDef {
  name: string
  description: string
  /** JSON Schema simples dos argumentos. */
  parameters: { type: 'object'; properties: Record<string, unknown>; required?: string[] }
}

export interface ToolCall {
  name: string
  args: Record<string, unknown>
}

export interface ToolResult {
  name: string
  response: unknown
}

/** Uma "vez" na conversa. As de ferramenta só existem dentro de uma resposta; não vão para o banco. */
export type ChatTurn =
  | { role: 'user'; content: string }
  | {
      role: 'assistant'
      content: string
      toolCalls?: ToolCall[]
      /** Dado opaco do provedor para repassar de volta (ex.: assinaturas de raciocínio do Gemini). */
      raw?: unknown
    }
  | { role: 'tool'; results: ToolResult[] }

export interface ChatRequest {
  system: string
  messages: ChatTurn[]
  tools?: ToolDef[]
  /** Cancela a chamada (ex.: você fechou a página no meio da resposta). */
  signal?: AbortSignal
}

export type AIEvent =
  | { type: 'text'; text: string }
  | { type: 'tool_calls'; calls: ToolCall[]; raw?: unknown }

export interface AIProvider {
  readonly name: string
  readonly model: string
  /** false quando falta chave/configuração. */
  isConfigured(): boolean
  /** Devolve a resposta aos poucos (streaming). */
  streamChat(req: ChatRequest): AsyncGenerator<AIEvent>
}

export type AIErrorCode =
  | 'not_configured'
  | 'auth'
  | 'rate_limit'
  | 'model'
  | 'network'
  | 'bad_response'

/** Erro com mensagem já em português, segura para mostrar na tela. */
export class AIError extends Error {
  constructor(
    message: string,
    public readonly code: AIErrorCode,
  ) {
    super(message)
    this.name = 'AIError'
  }
}

/**
 * Junta mensagens de texto seguidas do mesmo autor e garante que a conversa
 * comece pelo usuário. As APIs de IA exigem alternância user/assistant, e o
 * histórico pode ter um "user" sem resposta (quando a IA deu erro).
 * Turnos de ferramenta passam intactos.
 */
export function normalizeTurns(turns: ChatTurn[]): ChatTurn[] {
  const out: ChatTurn[] = []
  for (const t of turns) {
    const last = out[out.length - 1]
    const plain = (x: ChatTurn | undefined): x is Extract<ChatTurn, { role: 'user' | 'assistant' }> =>
      !!x && x.role !== 'tool' && !(x.role === 'assistant' && x.toolCalls?.length)
    if (plain(last) && plain(t) && last.role === t.role) last.content += `\n\n${t.content}`
    else out.push({ ...t })
  }
  while (out.length > 0 && out[0].role !== 'user') out.shift()
  return out
}
