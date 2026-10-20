import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

export type DB = Database.Database

const NOW = `strftime('%Y-%m-%dT%H:%M:%fZ','now')`

/*
  MIGRAÇÕES
  ---------
  Cada item abaixo é uma versão do esquema do banco. O número da versão fica
  guardado no próprio arquivo (PRAGMA user_version), então ao abrir o banco só
  rodam as migrações que ainda não rodaram. NUNCA edite uma migração antiga:
  para mudar o esquema, acrescente uma nova no fim da lista.
*/
const MIGRATIONS: string[] = [
  // 1 — Fase 2: histórico do chat
  `CREATE TABLE IF NOT EXISTS messages (
     id         INTEGER PRIMARY KEY AUTOINCREMENT,
     role       TEXT NOT NULL CHECK (role IN ('user','assistant')),
     content    TEXT NOT NULL,
     created_at TEXT NOT NULL DEFAULT (${NOW})
   );`,

  // 2 — Fase 3: tarefas, caixa de entrada, memórias e desenvolvimento pessoal
  `CREATE TABLE tasks (
     id           INTEGER PRIMARY KEY AUTOINCREMENT,
     title        TEXT NOT NULL,
     description  TEXT NOT NULL DEFAULT '',
     due_at       TEXT,
     priority     TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('high','normal','low')),
     category     TEXT NOT NULL DEFAULT '',
     status       TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','done','cancelled')),
     recurrence   TEXT,
     insistence   TEXT NOT NULL DEFAULT 'medium' CHECK (insistence IN ('low','medium','max')),
     parent_id    INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
     position     INTEGER NOT NULL DEFAULT 0,
     est_minutes  INTEGER,
     created_at   TEXT NOT NULL DEFAULT (${NOW}),
     updated_at   TEXT NOT NULL DEFAULT (${NOW}),
     completed_at TEXT
   );
   CREATE INDEX idx_tasks_parent ON tasks(parent_id);

   CREATE TABLE inbox (
     id         INTEGER PRIMARY KEY AUTOINCREMENT,
     text       TEXT NOT NULL,
     status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','discarded')),
     created_at TEXT NOT NULL DEFAULT (${NOW})
   );

   CREATE TABLE memories (
     id         INTEGER PRIMARY KEY AUTOINCREMENT,
     text       TEXT NOT NULL,
     category   TEXT NOT NULL DEFAULT 'notas',
     tags       TEXT NOT NULL DEFAULT '[]',
     importance INTEGER NOT NULL DEFAULT 3 CHECK (importance BETWEEN 1 AND 5),
     created_at TEXT NOT NULL DEFAULT (${NOW}),
     updated_at TEXT NOT NULL DEFAULT (${NOW})
   );

   CREATE TABLE goals (
     id         INTEGER PRIMARY KEY AUTOINCREMENT,
     title      TEXT NOT NULL,
     kind       TEXT NOT NULL CHECK (kind IN ('fixed','daily')),
     date       TEXT,
     created_on TEXT NOT NULL,
     ended_on   TEXT
   );
   CREATE TABLE goal_checks (
     goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
     date    TEXT NOT NULL,
     PRIMARY KEY (goal_id, date)
   );

   CREATE TABLE daily_log (
     date          TEXT PRIMARY KEY,
     exercised     INTEGER NOT NULL DEFAULT 0,
     exercise_note TEXT NOT NULL DEFAULT '',
     studied       INTEGER NOT NULL DEFAULT 0,
     study_hours   REAL,
     pages         INTEGER NOT NULL DEFAULT 0,
     sleep_hours   REAL,
     water_l       REAL NOT NULL DEFAULT 0,
     updated_at    TEXT NOT NULL DEFAULT (${NOW})
   );

   CREATE TABLE settings (
     key   TEXT PRIMARY KEY,
     value TEXT NOT NULL
   );`,
]

function migrate(db: DB) {
  const current = db.pragma('user_version', { simple: true }) as number
  for (let i = current; i < MIGRATIONS.length; i++) {
    // Cada migração roda inteira ou não roda (transação).
    db.transaction(() => {
      db.exec(MIGRATIONS[i])
      db.pragma(`user_version = ${i + 1}`)
    })()
  }
}

/**
 * Abre (e cria/atualiza, se preciso) o banco SQLite local. Use ':memory:' nos testes.
 * Os dados ficam em um único arquivo na sua máquina: backup = copiar o arquivo.
 */
export function openDb(file: string): DB {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true })
  const db = new Database(file)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON') // necessário para apagar passos junto com a tarefa
  migrate(db)
  return db
}
