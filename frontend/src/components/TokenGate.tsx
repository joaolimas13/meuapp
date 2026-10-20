import { useEffect, useState } from 'react'
import { getToken, setToken, UNAUTHORIZED_EVENT } from '../lib/auth'

/** Tela de senha: aparece quando o servidor responde "acesso negado" (GAIA_TOKEN definido). */
export function TokenGate() {
  const [needed, setNeeded] = useState(false)
  const [value, setValue] = useState('')
  useEffect(() => {
    const on = () => setNeeded(true)
    window.addEventListener(UNAUTHORIZED_EVENT, on)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, on)
  }, [])
  if (!needed) return null
  const submit = () => {
    if (!value.trim()) return
    setToken(value.trim())
    location.reload()
  }
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center p-6" style={{ background: 'rgba(2,8,13,.96)' }} role="dialog" aria-label="Acesso">
      <div className="hud-panel w-full max-w-md space-y-3 p-6" style={{ position: 'relative' }}>
        <h2 className="hud-title">Acesso ao GAIA</h2>
        <p style={{ color: 'var(--text-dim)' }}>{getToken() ? 'Token incorreto. Tente de novo.' : 'Este GAIA é protegido. Digite o token definido em GAIA_TOKEN.'}</p>
        <input type="password" autoFocus className="hud-input w-full" value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} aria-label="Token" />
        <button type="button" className="hud-btn primary" onClick={submit}>Entrar</button>
      </div>
    </div>
  )
}
