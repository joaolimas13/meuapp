import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface Props {
  title: string
  children: ReactNode
  /** Atraso (s) da animação de entrada, para os painéis "montarem" em sequência. */
  delay?: number
  className?: string
}

/** Painel de vidro com cantos chanfrados e entrada de "montagem holográfica". */
export function Panel({ title, children, delay = 0, className = '' }: Props) {
  return (
    <motion.section
      className={`hud-panel p-5 ${className}`}
      initial={{ opacity: 0, y: 14, scaleY: 0.94 }}
      // Pequeno "flicker" de opacidade imita um holograma ligando.
      animate={{ opacity: [0, 1, 0.45, 1], y: 0, scaleY: 1 }}
      transition={{ duration: 0.7, delay, ease: 'easeOut' }}
    >
      <h2 className="hud-title mb-3">{title}</h2>
      {children}
    </motion.section>
  )
}
