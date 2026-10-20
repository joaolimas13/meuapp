import { useEffect, useState } from 'react'
import type { OrbState } from '../../../shared/types'

const STATE_LABEL: Record<OrbState, string> = {
  idle: 'OCIOSO',
  listening: 'OUVINDO',
  thinking: 'PENSANDO',
  speaking: 'FALANDO',
  alert: 'ALERTA',
}

function useOnline() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

interface Props {
  orbState: OrbState
  ai: { label: string; ok: boolean }
  nightLabel: string
  lite: boolean
  hideHints: boolean
  mic: { label: string; ok: boolean }
}

/** Barra de status: conexão, IA, microfone, sincronização + atalhos de teste. */
export function StatusBar({ orbState, ai, nightLabel, lite, hideHints, mic }: Props) {
  const online = useOnline()
  const items: { label: string; ok: boolean }[] = [
    { label: online ? 'REDE ONLINE' : 'SEM INTERNET', ok: online },
    ai,
    mic,
    { label: 'DADOS LOCAIS', ok: true },
  ]

  return (
    <footer className="mono flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-6 py-3 text-xs">
      <div className="flex flex-wrap gap-x-5 gap-y-1">
        {items.map((i) => (
          <span key={i.label} style={{ color: i.ok ? 'var(--cyan)' : 'var(--amber)' }}>
            ● {i.label}
          </span>
        ))}
        <span style={{ color: 'var(--text-dim)' }}>ORBE: {STATE_LABEL[orbState]}</span>
      </div>
      {!hideHints && (
        <div style={{ color: 'var(--text-dim)' }}>
          [C·I·T·D·P·K·U·G·M·E·R·S] painel · [F] foco · [V] voz · TESTE: [1-5] orbe · [N] noturno ({nightLabel}) · [L] leve ({lite ? 'on' : 'off'}) ·
          [A] ambiente
        </div>
      )}
    </footer>
  )
}
