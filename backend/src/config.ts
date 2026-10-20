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
    timezone: env.GAIA_TIMEZONE ?? 'America/Sao_Paulo',
    historyContext: Number(env.GAIA_HISTORY_CONTEXT ?? 30),
    dbPath: env.GAIA_DB_PATH ?? path.resolve(here, '../data/gaia.sqlite'),
    staticDir: env.GAIA_STATIC_DIR ?? path.resolve(here, '../../frontend/dist'),
  }
}
