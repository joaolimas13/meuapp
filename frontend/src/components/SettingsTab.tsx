import { DEFAULT_APPEARANCE, resetAppearance, setAppearance, useAppearance, type LiteMode, type ThemeName } from '../lib/appearance'
import { withToken } from '../lib/auth'
import { useLoad } from '../hooks/useLoad'
import { getHealth } from '../lib/api'

const THEMES: { id: ThemeName; label: string }[] = [
  { id: 'ciano', label: 'Ciano (padrão)' },
  { id: 'horizon', label: 'Verde Horizon' },
  { id: 'laranja', label: 'Laranja Horizon' },
]

function Slider({ label, value, min, max, step = 1, unit, onChange }: { label: string; value: number; min: number; max: number; step?: number; unit: string; onChange: (n: number) => void }) {
  return (
    <label className="flex items-center gap-3">
      <span className="w-40">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="flex-1" aria-label={label} />
      <span className="mono w-16 text-right text-sm">{value}{unit}</span>
    </label>
  )
}

/** Ajustes deste aparelho (aparência, desempenho) e download dos seus dados. */
export function SettingsTab({ lite, autoSlow }: { lite: boolean; autoSlow: boolean }) {
  const a = useAppearance()
  const health = useLoad(() => getHealth(), [])
  const hours = Array.from({ length: 24 }, (_, h) => h)
  const hourSelect = (label: string, v: number, key: 'nightStart' | 'nightEnd') => (
    <label className="flex items-center gap-2">{label}
      <select className="hud-input" value={v} onChange={(e) => setAppearance({ [key]: Number(e.target.value) })} aria-label={label}>
        {hours.map((h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
      </select>
    </label>
  )
  const installHint = typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone), (display-mode: fullscreen)').matches

  return (
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1" data-testid="settings-tab">
      <p className="mono text-xs" style={{ color: 'var(--text-dim)' }}>Estes ajustes valem só para este aparelho (a tela do projetor e o celular podem ser diferentes).</p>

      <section className="space-y-2">
        <h3 className="hud-title">Aparência</h3>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tema">
          {THEMES.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={a.theme === t.id} className={`hud-btn ${a.theme === t.id ? 'primary' : ''}`} onClick={() => setAppearance({ theme: t.id })}>{t.label}</button>
          ))}
        </div>
        <Slider label="Brilho da tela" value={a.brightness} min={40} max={100} step={5} unit="%" onChange={(n) => setAppearance({ brightness: n })} />
        <Slider label="Tamanho das letras" value={a.fontScale} min={85} max={150} step={5} unit="%" onChange={(n) => setAppearance({ fontScale: n })} />
      </section>

      <section className="space-y-2">
        <h3 className="hud-title">Modo noturno e ambiente</h3>
        <div className="flex flex-wrap items-center gap-4">{hourSelect('Noturno das', a.nightStart, 'nightStart')}{hourSelect('até', a.nightEnd, 'nightEnd')}</div>
        <p className="mono text-xs" style={{ color: 'var(--text-dim)' }}>O horário de “desacelerar” (aba Rotina) também liga o modo noturno.</p>
        <Slider label="Modo ambiente após" value={a.ambientSec} min={15} max={600} step={15} unit="s" onChange={(n) => setAppearance({ ambientSec: n })} />
      </section>

      <section className="space-y-2">
        <h3 className="hud-title">Desempenho</h3>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Modo leve">
          {([['auto', 'Automático'], ['on', 'Sempre leve'], ['off', 'Efeitos completos']] as [LiteMode, string][]).map(([id, label]) => (
            <button key={id} type="button" role="radio" aria-checked={a.lite === id} className={`hud-btn ${a.lite === id ? 'primary' : ''}`} onClick={() => setAppearance({ lite: id })}>{label}</button>
          ))}
        </div>
        <p className="mono text-xs" style={{ color: 'var(--text-dim)' }} data-testid="lite-status">
          Agora: {lite ? 'modo leve ligado' : 'efeitos completos'}{autoSlow ? ' (o GAIA detectou lentidão e simplificou os efeitos)' : ''}.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="hud-title">Seus dados</h3>
        <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Tudo fica no seu computador. O GAIA também faz um backup por dia sozinho (pasta backend/data/backups, guarda os 7 últimos).</p>
        <div className="flex flex-wrap gap-2">
          <a className="hud-btn" href={withToken('/api/export')} download>Exportar tudo (JSON)</a>
          <a className="hud-btn" href={withToken('/api/memories/export?format=md')} download>Memórias (Markdown)</a>
          <a className="hud-btn" href={withToken('/api/backup')} download>Backup do banco (SQLite)</a>
        </div>
      </section>

      <section className="space-y-1">
        <h3 className="hud-title">Sobre</h3>
        <p className="mono text-xs" style={{ color: 'var(--text-dim)' }}>
          GAIA v1.0 · IA: {health.data ? `${health.data.ai.provider} (${health.data.ai.model})${health.data.ai.configured ? '' : ' · sem chave'}` : '…'}<br />
          {installHint ? 'Rodando como app instalado.' : 'Dica: no Chrome/Edge, menu ⋮ → “Instalar GAIA” para abrir como app em tela cheia.'}
        </p>
        <button type="button" className="hud-btn" onClick={() => resetAppearance()} disabled={JSON.stringify(a) === JSON.stringify(DEFAULT_APPEARANCE)}>Restaurar aparência padrão</button>
      </section>
    </div>
  )
}
