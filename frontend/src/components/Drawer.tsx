import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

export type TabId = 'chat' | 'inbox' | 'tasks' | 'day' | 'memories' | 'growth' | 'routine' | 'orders' | 'content' | 'study' | 'vault' | 'settings'

export const TABS: { id: TabId; label: string; key: string }[] = [
  { id: 'chat', label: 'Chat', key: 'C' },
  { id: 'inbox', label: 'Caixa', key: 'I' },
  { id: 'tasks', label: 'Tarefas', key: 'T' },
  { id: 'day', label: 'Dia', key: 'D' },
  { id: 'orders', label: 'Pedidos', key: 'P' },
  { id: 'content', label: 'Conteúdo', key: 'K' },
  { id: 'study', label: 'Estudos', key: 'U' },
  { id: 'vault', label: 'Cofre', key: 'G' },
  { id: 'memories', label: 'Memórias', key: 'M' },
  { id: 'growth', label: 'Evolução', key: 'E' },
  { id: 'routine', label: 'Rotina', key: 'R' },
  { id: 'settings', label: 'Ajustes', key: 'S' },
]

/** Gaveta lateral com abas. O conteúdo de cada aba entra como children. */
export function Drawer({
  tab, onTab, onClose, inboxCount, children,
}: { tab: TabId; onTab: (t: TabId) => void; onClose: () => void; inboxCount: number; children: ReactNode }) {
  return (
    <motion.aside
      className="hud-panel bottom-14 right-3 top-12 z-30 flex w-[min(38rem,calc(100vw-1.5rem))] flex-col p-4"
      // position inline: .hud-panel (position: relative) vence a classe "fixed" do Tailwind.
      style={{ position: 'fixed', background: 'rgba(3, 14, 20, 0.92)' }}
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ duration: 0.3 }}
      aria-label="Painel do GAIA"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <nav className="flex flex-wrap gap-1" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => onTab(t.id)}
              className={`hud-btn ${tab === t.id ? 'primary' : ''}`}
            >
              {t.label}
              {t.id === 'inbox' && inboxCount > 0 ? ` (${inboxCount})` : ''}
            </button>
          ))}
        </nav>
        <button type="button" className="hud-btn" onClick={onClose} aria-label="Fechar painel">Fechar</button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </motion.aside>
  )
}
