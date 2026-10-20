import { useEffect } from 'react'
import { useLoad } from '../hooks/useLoad'
import { api } from '../lib/api'
import { CONFIG } from '../lib/config'
import { playCue, speak } from '../lib/sound'
import { Panel } from './Panel'

/** Constância no Instagram: "hoje é dia de postar" (aviso suave, sem culpa). */
export function ContentCard({ version, onOpen, onChanged, delay }: { version: number; onOpen: () => void; onChanged: () => void; delay?: number }) {
  const { data, reload } = useLoad(api.contentToday, [version])
  useEffect(() => {
    const t = setInterval(reload, 60_000)
    return () => clearInterval(t)
  }, [reload])

  // Um lembrete falado por dia, quando chega o horário e ainda não postou.
  useEffect(() => {
    if (!data?.pending || !data.remindNow) return
    const key = `gaia.contentNudge.${data.date}`
    try {
      if (localStorage.getItem(key)) return
      localStorage.setItem(key, '1')
    } catch { /* sem localStorage: lembra só uma vez por carregamento */ }
    playCue('alert1')
    setTimeout(() => speak(`${CONFIG.userName}, hoje é dia de postar.${data.post ? ` Tem planejado: ${data.post.title}.` : ''}`), 900)
  }, [data])

  return (
    <Panel title="Conteúdo" delay={delay}>
      {!data ? (
        <p style={{ color: 'var(--text-dim)' }}>Carregando…</p>
      ) : data.pending ? (
        <div>
          <div style={{ color: 'var(--amber)' }}>Hoje é dia de postar{data.remindNow ? '' : ` (aviso às ${data.remindAt})`}.</div>
          <div className="text-lg">{data.post ? data.post.title : 'Nada planejado ainda. Pegue uma ideia do banco.'}</div>
          {data.post && (
            <button type="button" className="hud-btn primary mt-2 mr-2" onClick={() => api.contentStep(data.post!.id, 'postado', true).then(() => { playCue('done'); onChanged(); reload() })}>Já postei</button>
          )}
        </div>
      ) : (
        <p style={{ color: 'var(--text-dim)' }}>{data.postingDay ? 'Hoje já foi. Bom trabalho.' : 'Hoje não é dia de postar.'}</p>
      )}
      <button type="button" className="hud-btn mt-2" onClick={onOpen}>Abrir calendário</button>
    </Panel>
  )
}
