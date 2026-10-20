import type { Config } from '../config'
import { GeminiProvider } from './gemini'
import { MockProvider } from './mock'
import type { AIProvider } from './types'

/** Escolhe o provedor de IA conforme AI_PROVIDER. Para adicionar outro (Claude...), inclua um case. */
export function createProvider(config: Config): AIProvider {
  switch (config.aiProvider) {
    case 'mock':
      return new MockProvider()
    case 'gemini':
      return new GeminiProvider({ apiKey: config.geminiApiKey, model: config.geminiModel })
  }
}

export * from './types'
