import { useEffect, useState } from 'react'
import { useLoad } from '../hooks/useLoad'
import { api } from '../lib/api'
import { CONFIG } from '../lib/config'
import { playCue, speak } from '../lib/sound'
import { Panel } from './Panel'

const LEVELS = [1, 2, 3, 4, 5]

function Scale({ label, value, onPick }: { label: string; value: number | null; onPick: (n: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="mono w-16 text-xs" style={{ color: 'var(--text-dim)' }}>{label}</span>
      {LEVELS.map((n) => (
        <button key={n} type="button" className={`hud-btn ${value === n ? 'primary' : ''}`} onClick={() => onPick(n)} aria-label={`${label} ${n}`}>{n}</button>
      ))}
    </div>
  )
}

/**
 * Cartão de bem-estar do painel principal: check-in de energia/humor (1 toque por nota),
 * revisão de estudos pendente e a mensagem de incentivo. Nada aqui cobra ou culpa.
 */
export function WellbeingCard({ version, onChanged, onOpenStudy, delay }: { version: number; onChanged: () => void; onOpenStudy: () => void; delay?: number }) {
  const check = useLoad(api.checkinSummary, [version])
  const well = useLoad(api.wellbeing, [version])
  const study = useLoad(api.study, [version])
  const [energy, setEnergy] = useState<number | null>(null)
  const [mood, setMood] = useState<number | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    const t = setInterval(() => { check.reload(); study.reload() }, 5 * 60_000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const due = check.data?.due ?? false
  // Convite falado uma vez por hora no máximo (o check-in só aparece quando faz sentido).
  useEffect(() => {
    if (!due) return
    const key = 'gaia.checkinNudge'
    try {
      const last = Number(localStorage.getItem(key) ?? 0)
      if (Date.now() - last < 3600_000) return
      localStorage.setItem(key, String(Date.now()))
    } catch { /* sem localStorage: convida uma vez por carregamento */ }
    playCue('alert1')
    setTimeout(() => speak(`${CONFIG.userName}, como estão sua energia e seu humor agora?`), 900)
  }, [due])

  const submit = async () => {
    if (energy === null || mood === null) return
    try {
      setErr(null)
      check.set(await api.addCheckin(energy, mood))
      setEnergy(null)
      setMood(null)
      playCue('confirm')
      onChanged()
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  const dueCards = study.data?.dueCount ?? 0
  return (
    <Panel title="Bem-estar" delay={delay}>
      <div className="space-y-2" data-testid="wellbeing-card">
        {due ? (
          <div className="space-y-1" data-testid="checkin-form">
            <div style={{ color: 'var(--amber)' }}>Como você está agora?</div>
            <Scale label="Energia" value={energy} onPick={setEnergy} />
            <Scale label="Humor" value={mood} onPick={setMood} />
            <button type="button" className="hud-btn primary" disabled={energy === null || mood === null} onClick={submit}>Registrar</button>
          </div>
        ) : (
          check.data?.last && (
            <div className="mono text-sm" style={{ color: 'var(--text-dim)' }}>
              Último check-in {check.data.last.time}: energia {check.data.last.energy}, humor {check.data.last.mood}
            </div>
          )
        )}
        {err && <div className="mono text-sm" style={{ color: 'var(--amber)' }} role="alert">! {err}</div>}
        {dueCards > 0 && (
          <button type="button" className="hud-btn block w-full text-left" onClick={onOpenStudy}>
            {dueCards} cartão(ões) de estudo para revisar (2 minutos)
          </button>
        )}
        {well.data && <p className="text-sm" style={{ color: 'var(--text-dim)' }}>{well.data.message}</p>}
      </div>
    </Panel>
  )
}
