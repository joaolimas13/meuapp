import { createProvider } from './ai'
import { loadConfig } from './config'
import { openDb } from './db'
import { buildServer } from './server'

const config = loadConfig()
const provider = createProvider(config)
const db = openDb(config.dbPath)
const app = buildServer({ config, provider, db })

await app.listen({ port: config.port, host: config.host })

console.log(`GAIA backend em http://${config.host}:${config.port}`)
console.log(`IA: ${provider.name} (${provider.model}) — ${provider.isConfigured() ? 'configurada' : 'SEM CHAVE: preencha GEMINI_API_KEY no backend/.env'}`)
