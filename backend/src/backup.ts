import fs from 'node:fs'
import path from 'node:path'
import type { DB } from './db'

/*
  BACKUP E EXPORTAÇÃO
  -------------------
  - exportAll: todas as tabelas em JSON (legível, serve para migrar ou guardar).
  - backupTo / dailyBackup: cópia consistente do arquivo SQLite (usa a API de backup do
    próprio SQLite, que é segura mesmo com o GAIA rodando).
  Para restaurar: pare o GAIA e troque backend/data/gaia.sqlite por uma cópia de backend/data/backups/.
*/

/** Todas as tabelas do usuário em um objeto { tabela: linhas[] }. */
export function exportAll(db: DB): Record<string, unknown[]> {
  const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[]).map((t) => t.name)
  const out: Record<string, unknown[]> = {}
  for (const t of tables) out[t] = db.prepare(`SELECT * FROM "${t}"`).all() // nomes vêm do próprio SQLite, não do usuário
  return out
}

export async function backupTo(db: DB, file: string): Promise<void> {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  await db.backup(file)
}

/**
 * Faz no máximo um backup por dia (gaia-AAAA-MM-DD.sqlite) e mantém só os `keep` mais recentes.
 * Devolve o caminho criado, ou null se o de hoje já existia.
 */
export async function dailyBackup(db: DB, dir: string, today: string, keep = 7): Promise<string | null> {
  const file = path.join(dir, `gaia-${today}.sqlite`)
  if (fs.existsSync(file)) return null
  await backupTo(db, file)
  const old = fs.readdirSync(dir).filter((f) => /^gaia-\d{4}-\d{2}-\d{2}\.sqlite$/.test(f)).sort().reverse().slice(keep)
  for (const f of old) fs.rmSync(path.join(dir, f), { force: true })
  return file
}
