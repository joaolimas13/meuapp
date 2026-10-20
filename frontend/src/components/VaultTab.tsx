import { useState } from 'react'
import type { VaultStatus } from '../../../shared/types'
import { useLoad } from '../hooks/useLoad'
import { api } from '../lib/api'
import { ErrorLine } from './ErrorLine'

/** Cofre de ideias e projetos: guardar sem pressa e, na revisão, decidir executar, adiar ou descartar. */
export function VaultTab({ version, onChanged }: { version: number; onChanged: () => void }) {
  const { data, error, set, reload } = useLoad(api.vault, [version])
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<'ideia' | 'projeto'>('ideia')
  const [err, setErr] = useState<string | null>(null)

  const act = async (fn: () => Promise<unknown>) => {
    try {
      setErr(null)
      await fn()
      onChanged()
    } catch (e) {
      setErr((e as Error).message)
    }
  }
  const decide = (id: number, status: VaultStatus) => act(async () => set(await api.setVaultStatus(id, status)))
  const add = () => act(async () => { await api.addVault({ title: title.trim(), kind }); setTitle(''); reload() })
  const items = data ?? []

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1" data-testid="vault-tab">
      <ErrorLine msg={err ?? error} />
      <div className="flex gap-2">
        <input className="hud-input flex-1" placeholder="Nova ideia ou projeto…" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && title.trim() && add()} aria-label="Nova ideia" />
        <select className="hud-input" value={kind} onChange={(e) => setKind(e.target.value as 'ideia' | 'projeto')} aria-label="Tipo"><option value="ideia">ideia</option><option value="projeto">projeto</option></select>
        <button type="button" className="hud-btn primary" disabled={!title.trim()} onClick={add}>Guardar</button>
      </div>
      {items.length === 0 && <p style={{ color: 'var(--text-dim)' }}>O cofre está vazio. Guarde aqui o que não precisa ser feito agora.</p>}
      <ul className="space-y-2">
        {items.map((i) => (
          <li key={i.id} className="border-b pb-2" style={{ borderColor: 'var(--line)' }}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div>{i.title}</div>
                <div className="mono text-xs" style={{ color: 'var(--text-dim)' }}>{i.kind}{i.status === 'adiada' ? ' · adiada' : i.status === 'executar' ? ' · em execução' : ''}</div>
              </div>
              <div className="flex shrink-0 gap-1">
                {i.status !== 'executar' && <button type="button" className="hud-btn primary" onClick={() => decide(i.id, 'executar')}>Executar</button>}
                <button type="button" className="hud-btn" onClick={() => decide(i.id, 'adiada')}>Adiar</button>
                <button type="button" className="hud-btn" onClick={() => decide(i.id, 'descartada')}>Descartar</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <p className="mono text-xs" style={{ color: 'var(--text-dim)' }}>“Executar” cria uma tarefa. Uma vez por mês o GAIA lembra de revisar o cofre.</p>
    </div>
  )
}
