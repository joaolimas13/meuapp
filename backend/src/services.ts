import type { AIProvider } from './ai'
import type { Config } from './config'
import { AnchorsRepo } from './db/anchorsRepo'
import { ChatRepo } from './db/chatRepo'
import { FocusRepo } from './db/focusRepo'
import { SettingsRepo } from './db/settingsRepo'
import { DevRepo } from './db/devRepo'
import { InboxRepo } from './db/inboxRepo'
import type { DB } from './db'
import { MemoriesRepo } from './db/memoriesRepo'
import { TasksRepo } from './db/tasksRepo'
import { DevService } from './dev/service'
import { localNow, type LocalNow } from './lib/time'

/** Tudo que as rotas e as ferramentas do GAIA usam, num lugar só. */
export interface Services {
  config: Config
  provider: AIProvider
  chat: ChatRepo
  tasks: TasksRepo
  memories: MemoriesRepo
  inbox: InboxRepo
  dev: DevService
  focus: FocusRepo
  anchors: AnchorsRepo
  settings: SettingsRepo
  /** Relógio injetável (os testes fixam a hora). */
  now: () => Date
  /** Data e hora locais agora, no fuso configurado. */
  local: () => LocalNow
}

export function createServices(deps: { config: Config; provider: AIProvider; db: DB; now?: () => Date }): Services {
  const now = deps.now ?? (() => new Date())
  return {
    config: deps.config,
    provider: deps.provider,
    chat: new ChatRepo(deps.db),
    tasks: new TasksRepo(deps.db),
    memories: new MemoriesRepo(deps.db),
    inbox: new InboxRepo(deps.db),
    dev: new DevService(new DevRepo(deps.db)),
    focus: new FocusRepo(deps.db),
    anchors: new AnchorsRepo(deps.db),
    settings: new SettingsRepo(deps.db),
    now,
    local: () => localNow(deps.config.timezone, now()),
  }
}
