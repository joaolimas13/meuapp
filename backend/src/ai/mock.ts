import type { AIEvent, AIProvider, ChatRequest, ToolCall } from './types'

/**
 * Provedor de teste: responde sem internet nem chave. Também "simula" o uso de
 * ferramentas, para dar para testar tarefas, memórias e Caixa sem a IA real:
 *   /tarefa Ligar para o dentista amanhã   → cria uma tarefa
 *   /passos Arrumar a garagem              → cria tarefa com 3 passos
 *   /memoria Minha cor favorita é azul     → salva uma memória
 *   /anota ideia de brinde                 → captura na Caixa de Entrada
 */
export class MockProvider implements AIProvider {
  readonly name = 'mock'
  readonly model = 'mock-1'

  constructor(private readonly delayMs = 25) {}

  isConfigured() {
    return true
  }

  async *streamChat({ messages, tools, signal }: ChatRequest): AsyncGenerator<AIEvent> {
    const last = messages[messages.length - 1]

    // Voltou o resultado das ferramentas: fecha a resposta.
    if (last?.role === 'tool') {
      const failed = last.results.some((r) => (r.response as { error?: string })?.error)
      yield* this.say(failed ? 'Não consegui concluir isso.' : 'Pronto, feito.', signal)
      return
    }

    const text = last?.role === 'user' ? last.content : ''
    const m = /^\/(tarefa|passos|memoria|anota)\s+(.+)$/is.exec(text)
    if (m && tools?.length) {
      const arg = m[2].trim()
      const call: ToolCall =
        m[1].toLowerCase() === 'tarefa'
          ? { name: 'create_task', args: { title: arg } }
          : m[1].toLowerCase() === 'passos'
            ? {
                name: 'create_task',
                args: {
                  title: arg,
                  steps: [
                    { title: 'Separar o que for preciso', minutes: 5 },
                    { title: 'Fazer a primeira parte', minutes: 10 },
                    { title: 'Revisar e fechar', minutes: 10 },
                  ],
                },
              }
            : m[1].toLowerCase() === 'memoria'
              ? { name: 'save_memory', args: { text: arg, category: 'notas' } }
              : { name: 'capture_inbox', args: { text: arg } }
      yield { type: 'tool_calls', calls: [call] }
      return
    }

    yield* this.say(
      `Modo de teste ativo. Você disse: "${text}". Com a chave do Gemini configurada, eu respondo de verdade.`,
      signal,
    )
  }

  private async *say(reply: string, signal?: AbortSignal): AsyncGenerator<AIEvent> {
    for (const word of reply.split(/(?<= )/)) {
      if (signal?.aborted) return
      await new Promise((r) => setTimeout(r, this.delayMs))
      yield { type: 'text', text: word }
    }
  }
}
