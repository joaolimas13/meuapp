import { useState } from 'react';
import {
  useTodayMedicationLog,
  useWeekMedicationLogs,
  logMedicationTaken,
  setEffectNote,
} from '../hooks/useMedication';
import { getMedicationWindows } from '../lib/pharma';
import { formatTime, formatDateShort } from '../lib/dateUtils';

const EFFECT_OPTIONS = ['fraco', 'normal', 'intenso'];

export default function MedicationLog() {
  const today = useTodayMedicationLog();
  const week = useWeekMedicationLogs();
  const [busy, setBusy] = useState(false);

  async function handleTake() {
    setBusy(true);
    await logMedicationTaken(Date.now());
    setBusy(false);
  }

  async function handleEffect(note) {
    if (!today) return;
    await setEffectNote(today.id, note);
  }

  const windows = today ? getMedicationWindows(today.timestamp) : null;

  return (
    <section className="screen">
      <h1>Medicação</h1>

      {!today ? (
        <button className="big-button primary" disabled={busy} onClick={handleTake}>
          Registrar tomada agora
        </button>
      ) : (
        <div className="card">
          <p className="muted">Tomado às {formatTime(today.timestamp)}</p>
          <ul className="window-list">
            <li>Início de efeito: ~{formatTime(windows.onsetStart)}</li>
            <li>Pico: {formatTime(windows.peakStart)} – {formatTime(windows.peakEnd)}</li>
            <li>Declínio a partir de: {formatTime(windows.declineStart)}</li>
          </ul>

          <p className="muted" style={{ marginTop: 16 }}>Como foi o efeito hoje? (opcional)</p>
          <div className="chip-row">
            {EFFECT_OPTIONS.map((opt) => (
              <button
                key={opt}
                className={`chip ${today.effectNote === opt ? 'chip-active' : ''}`}
                onClick={() => handleEffect(opt)}
              >
                {opt}
              </button>
            ))}
          </div>

          <button className="big-button" disabled={busy} onClick={handleTake} style={{ marginTop: 16 }}>
            Registrar nova tomada
          </button>
        </div>
      )}

      <h2 style={{ marginTop: 32 }}>Últimos 7 dias</h2>
      <div className="card">
        {!week || week.length === 0 ? (
          <p className="muted">Sem registros ainda.</p>
        ) : (
          <table className="simple-table">
            <tbody>
              {week.map((log) => (
                <tr key={log.id}>
                  <td>{formatDateShort(log.timestamp)}</td>
                  <td>{formatTime(log.timestamp)}</td>
                  <td className="muted">{log.effectNote || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
