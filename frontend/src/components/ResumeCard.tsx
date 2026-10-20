import type { Bridge } from '../../../shared/types'

/** "Você estava fazendo X; o próximo passo era Y. Retomamos?" — ponte entre tarefas. */
export function ResumeCard({ bridge, onResume, onDismiss }: { bridge: Bridge; onResume: () => void; onDismiss: () => void }) {
  return (
    <div className="hud-panel mx-auto w-full max-w-md p-3 text-center" data-testid="resume-card">
      <div className="hud-title" style={{ color: 'var(--amber)' }}>Onde você parou</div>
      <div className="mt-1 text-lg">Você estava fazendo <b>{bridge.title}</b>{bridge.note ? ` (${bridge.note})` : ''}.</div>
      {bridge.nextStep && <div style={{ color: 'var(--cyan)' }}>O próximo passo era: {bridge.nextStep}. Retomamos?</div>}
      <div className="mt-2 flex justify-center gap-2">
        <button type="button" className="hud-btn primary" onClick={onResume}>Retomar</button>
        <button type="button" className="hud-btn" onClick={onDismiss}>Agora não</button>
      </div>
    </div>
  )
}
