import { createProvider } from './ai'
import { assertSafeExposure, loadConfig } from './config'
import path from 'node:path'
import { dailyBackup } from './backup'
import { openDb } from './db'
import { localNow } from './lib/time'
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

// Backup diário automático (mantém os 7 mais recentes). Não vale para banco em memória.
const backupDir = path.join(path.dirname(config.dbPath), 'backups')
const runBackup = () =>
  dailyBackup(db, backupDir, localNow(config.timezone, new Date()).date)
    .then((f) => f && console.log(`Backup criado: ${f}`))
    .catch((e) => console.error('Falha no backup diário:', e instanceof Error ? e.message : e))
void runBackup()
setInterval(runBackup, 6 * 3600_000).unref()
