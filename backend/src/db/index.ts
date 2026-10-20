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

  // v3 — Fase 4: soneca de lembretes, foco, pontes ("onde eu parei"), âncoras de rotina
  `CREATE TABLE reminder_state (
     task_id       INTEGER PRIMARY KEY REFERENCES tasks(id) ON DELETE CASCADE,
     snoozed_until TEXT
   );

   CREATE TABLE focus_sessions (
     id            INTEGER PRIMARY KEY AUTOINCREMENT,
     task_id       INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
     title         TEXT NOT NULL,
     minutes       INTEGER NOT NULL,
     break_minutes INTEGER NOT NULL DEFAULT 5,
     started_at    TEXT NOT NULL,
     ended_at      TEXT,
     outcome       TEXT
   );

   CREATE TABLE bridges (
     id         INTEGER PRIMARY KEY AUTOINCREMENT,
     task_id    INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
     title      TEXT NOT NULL,
     note       TEXT NOT NULL DEFAULT '',
     next_step  TEXT NOT NULL DEFAULT '',
     resolved   INTEGER NOT NULL DEFAULT 0,
     created_at TEXT NOT NULL DEFAULT (${NOW})
   );

   CREATE TABLE anchors (
     id       INTEGER PRIMARY KEY AUTOINCREMENT,
     key      TEXT NOT NULL UNIQUE,
     title    TEXT NOT NULL,
     position INTEGER NOT NULL
   );
   CREATE TABLE anchor_items (
     id        INTEGER PRIMARY KEY AUTOINCREMENT,
     anchor_id INTEGER NOT NULL REFERENCES anchors(id) ON DELETE CASCADE,
     text      TEXT NOT NULL,
     position  INTEGER NOT NULL DEFAULT 0
   );
   CREATE TABLE anchor_checks (
     item_id INTEGER NOT NULL REFERENCES anchor_items(id) ON DELETE CASCADE,
     date    TEXT NOT NULL,
     PRIMARY KEY (item_id, date)
   );

   INSERT INTO anchors (key, title, position) VALUES
     ('acordar','Ao acordar',1), ('sair','Antes de sair de casa',2),
     ('chegar','Ao chegar em casa',3), ('dormir','Antes de dormir',4);
   INSERT INTO anchor_items (anchor_id, text, position) VALUES
     (1,'Beber um copo de água',1), (1,'Remédios',2),
     (2,'Chaves',1), (2,'Carteira',2), (2,'Celular',3),
     (3,'Guardar as chaves no lugar',1), (3,'Celular para carregar',2),
     (4,'Separar a roupa de amanhã',1), (4,'Celular no carregador',2), (4,'Desacelerar: luz baixa, sem telas',3);`,

  // v4 — calendário de conteúdo (Instagram) e banco de ideias
  `CREATE TABLE content_posts (
     id         INTEGER PRIMARY KEY AUTOINCREMENT,
     title      TEXT NOT NULL,
     kind       TEXT NOT NULL DEFAULT 'reel' CHECK (kind IN ('reel','post','story')),
     product    TEXT NOT NULL DEFAULT '',
     notes      TEXT NOT NULL DEFAULT '',
     date       TEXT,
     steps      TEXT NOT NULL DEFAULT '[]',
     posted_at  TEXT,
     created_at TEXT NOT NULL DEFAULT (${NOW})
   );
   CREATE INDEX idx_content_date ON content_posts(date);`,
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
