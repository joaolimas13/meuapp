import { useNow } from '../hooks/useNow'

/** Relógio e data grandes, legíveis à distância. */
export function Clock({ ambient }: { ambient: boolean }) {
  const now = useNow(1000)
  const hm = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const ss = String(now.getSeconds()).padStart(2, '0')
  const date = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="text-center">
      <div
        className="leading-none"
        style={{
          fontFamily: 'var(--font-title)',
          fontWeight: 600,
          fontSize: ambient ? '4.5rem' : '3.6rem',
          color: 'var(--text)',
          textShadow: 'var(--glow)',
          transition: 'font-size 0.8s ease',
        }}
      >
        {hm}
        <span className="mono ml-2 align-top" style={{ fontSize: '1.3rem', color: 'var(--cyan)' }}>
          {ss}
        </span>
      </div>
      <div className="mt-2 text-lg tracking-widest first-letter:uppercase" style={{ color: 'var(--text-dim)' }}>
        {date}
      </div>
    </div>
  )
}
