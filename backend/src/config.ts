import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

export interface Config {
  port: number
  host: string
  aiProvider: 'gemini' | 'mock'
  geminiApiKey: string
  geminiModel: string
  userName: string
  /** Senha de acesso à API (GAIA_TOKEN). Obrigatória se o servidor ficar acessível fora deste computador. */
  token: string
  timezone: string
  /** Quantas mensagens anteriores vão como contexto para a IA. */
  historyContext: number
  dbPath: string
  /** Pasta do frontend já compilado (npm run build). Se existir, o backend serve a interface. */
  staticDir: string
}

/** Lê as configurações das variáveis de ambiente (arquivo backend/.env). */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const provider = (env.AI_PROVIDER ?? 'gemini').toLowerCase()
  if (provider !== 'gemini' && provider !== 'mock') {
    throw new Error(`AI_PROVIDER inválido: "${provider}". Use "gemini" ou "mock".`)
  }
  return {
    port: Number(env.PORT ?? 8787),
    host: env.HOST ?? '127.0.0.1',
    aiProvider: provider,
    geminiApiKey: (env.GEMINI_API_KEY ?? '').trim(),
    geminiModel: env.GEMINI_MODEL ?? 'gemini-3.8-flash',
    userName: env.GAIA_USER_NAME ?? 'JP',
    token: (env.GAIA_TOKEN ?? '').trim(),
    timezone: env.GAIA_TIMEZONE ?? 'America/Sao_Paulo',
    historyContext: Number(env.GAIA_HISTORY_CONTEXT ?? 30),
    dbPath: env.GAIA_DB_PATH ?? path.resolve(here, '../data/gaia.sqlite'),
    staticDir: env.GAIA_STATIC_DIR ?? path.resolve(here, '../../frontend/dist'),
  }
}

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1'])

/** Recusa subir exposto à rede sem senha: seus dados pessoais não podem ficar abertos. */
export function assertSafeExposure(c: Config) {
  if (!LOOPBACK.has(c.host) && c.token.length < 16) {
    throw new Error(
      `HOST=${c.host} deixa o GAIA acessível por outros aparelhos, mas GAIA_TOKEN está vazio ou curto (mínimo 16 caracteres). ` +
        'Defina GAIA_TOKEN no backend/.env (ex.: uma frase longa) ou use HOST=127.0.0.1.',
    )
  }
}
