import { useState } from 'react'
import { useLoad } from '../hooks/useLoad'
import { api } from '../lib/api'
import { getAudioPrefs, playCue, setAudioPrefs, speak, unlockAudio } from '../lib/sound'
import { ErrorLine } from './ErrorLine'

/** Âncoras de rotina (checklists ligados a momentos do dia) e configurações de alerta/escala. */
export function RoutineTab({ onChanged }: { onChanged: () => void }) {
  const anchors = useLoad(api.anchors, [])
  const settings = useLoad(api.settings, [])
  const [open, setOpen] = useState<number | null>(null)
  const [newItem, setNewItem] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [audio, setAudio] = useState(getAudioPrefs())

  const act = async (fn: () => Promise<unknown>) => {
    try {
      setErr(null)
      await fn()
      onChanged()
    } catch (e) {
      setErr((e as Error).message)
    }
  }
  const save = (patch: Record<string, unknown>) => act(async () => settings.set(await api.saveSettings(patch)))
  const g = settings.data

  return (
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1" data-testid="routine-tab">
      <ErrorLine msg={err ?? anchors.error ?? settings.error} />
      <section>
        <h3 className="hud-title mb-1">Âncoras de rotina</h3>
        <div className="space-y-2">
          {anchors.data?.map((a) => {
            const done = a.items.filter((i) => i.done).length
            return (
              <div key={a.id} className="border-b pb-2" style={{ borderColor: 'var(--line)' }}>
                <button type="button" className="flex w-full items-center justify-between text-left" onClick={() => setOpen(open === a.id ? null : a.id)} aria-expanded={open === a.id}>
                  <span className="text-lg">{a.title}</span>
                  <span className="mono text-xs" style={{ color: done === a.items.length && a.items.length > 0 ? 'var(--cyan)' : 'var(--text-dim)' }}>{done}/{a.items.length}</span>
                </button>
                {open === a.id && (
                  <div className="mt-1 space-y-1 pl-2">
                    {a.items.map((i) => (
                      <div key={i.id} className="flex items-center justify-between gap-2">
                        <label className="flex items-center gap-2">
                          <input type="checkbox" checked={i.done} onChange={(e) => act(async () => { anchors.set(await api.checkAnchorItem(i.id, e.target.checked)); if (e.target.checked) playCue('confirm') })} />
                          <span style={{ opacity: i.done ? 0.55 : 1 }}>{i.text}</span>
                        </label>
                        <button type="button" className="hud-btn" aria-label={`Remover ${i.text}`} onClick={() => act(async () => { await api.deleteAnchorItem(i.id); anchors.reload() })}>×</button>
                      </div>
                    ))}
                    <div className="flex gap-2 pt-1">
                      <input className="hud-input flex-1" placeholder="Novo item…" value={newItem} onChange={(e) => setNewItem(e.target.value)} aria-label="Novo item" onKeyDown={(e) => { if (e.key === 'Enter' && newItem.trim()) act(async () => { anchors.set(await api.addAnchorItem(a.id, newItem.trim())); setNewItem('') }) }} />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="hud-title">Alertas e silêncio</h3>
        <label className="flex items-center gap-2"><input type="checkbox" checked={audio.sound} onChange={(e) => { unlockAudio(); setAudioPrefs({ sound: e.target.checked }); setAudio(getAudioPrefs()) }} /> Som dos alertas</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={audio.voice} onChange={(e) => { setAudioPrefs({ voice: e.target.checked }); setAudio(getAudioPrefs()) }} /> GAIA fala os alertas</label>
        <div className="flex gap-2">
          <button type="button" className="hud-btn" onClick={() => { unlockAudio(); setTimeout(() => playCue('alert2'), 100) }}>Testar som</button>
          <button type="button" className="hud-btn" onClick={() => speak('Olá. Esta é a voz do GAIA.')}>Testar voz</button>
        </div>
        {g && (
          <>
            <label className="flex items-center gap-2"><input type="checkbox" checked={g.dnd} onChange={(e) => save({ dnd: e.target.checked })} /> Não perturbe (só avisos visuais)</label>
            <div className="flex items-center gap-2">
              Silêncio das
              <input type="time" className="hud-input" value={g.quietStart} onChange={(e) => e.target.value && save({ quietStart: e.target.value })} aria-label="Início do silêncio" />
              às
              <input type="time" className="hud-input" value={g.quietEnd} onChange={(e) => e.target.value && save({ quietEnd: e.target.value })} aria-label="Fim do silêncio" />
            </div>
          </>
        )}
      </section>

      {g && (
        <section className="space-y-2">
          <h3 className="hud-title">Escala de trabalho</h3>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={g.shift.enabled} onChange={(e) => save({ shift: { enabled: e.target.checked, anchorDate: g.shift.anchorDate ?? new Date().toLocaleDateString('sv-SE') } })} aria-label="Usar escala" />
            Usar escala em ciclo
          </label>
          {g.shift.enabled && (
            <div className="space-y-2">
              <label className="flex items-center gap-2">Um dia de plantão: <input type="date" className="hud-input" value={g.shift.anchorDate ?? ''} onChange={(e) => e.target.value && save({ shift: { anchorDate: e.target.value } })} aria-label="Dia de plantão" /></label>
              <div className="flex items-center gap-2">
                Trabalha <input type="number" min={1} className="hud-input w-20" value={g.shift.workDays} onChange={(e) => save({ shift: { workDays: Number(e.target.value) } })} aria-label="Dias de trabalho" /> dia(s), folga
                <input type="number" min={0} className="hud-input w-20" value={g.shift.offDays} onChange={(e) => save({ shift: { offDays: Number(e.target.value) } })} aria-label="Dias de folga" /> dia(s)
              </div>
              <p className="mono text-xs" style={{ color: 'var(--text-dim)' }}>24h de trabalho / 72h de folga = 1 dia de trabalho e 3 de folga.</p>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
