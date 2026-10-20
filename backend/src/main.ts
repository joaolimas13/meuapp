import { createProvider } from './ai'
import { assertSafeExposure, loadConfig } from './config'
import { openDb } from './db'
import { buildServer } from './server'

const config = loadConfig()
assertSafeExposure(config)
const provider = createProvider(config)
const db = openDb(config.dbPath)
const app = buildServer({ config, provider, db })

await app.listen({ port: config.port, host: config.host })

console.log(`GAIA backend em http://${config.host}:${config.port}`)
console.log(config.token ? 'Acesso: protegido por GAIA_TOKEN' : 'Acesso: sem senha (somente este computador)')
console.log(`IA: ${provider.name} (${provider.model}) — ${provider.isConfigured() ? 'configurada' : 'SEM CHAVE: preencha GEMINI_API_KEY no backend/.env'}`)
