import { useState } from 'react';
import { useTodayMoodLogs, useRecentMoodLogs, logMood, getPeriod } from '../hooks/useMood';
import { formatTime, formatDateShort } from '../lib/dateUtils';

const SCALE = [1, 2, 3, 4, 5];

function ScaleInput({ label, value, onChange }) {
  return (
    <div className="scale-row">
      <p className="muted">{label}</p>
      <div className="chip-row">
        {SCALE.map((n) => (
          <button
            key={n}
            className={`chip ${value === n ? 'chip-active' : ''}`}
            onClick={() => onChange(n)}
            type="button"
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function MoodLog() {
  const today = useTodayMoodLogs();
  const recent = useRecentMoodLogs(14);
  const [mood, setMood] = useState(null);
  const [anxiety, setAnxiety] = useState(null);
  const [energy, setEnergy] = useState(null);
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);

  const period = getPeriod();
  const alreadyLogged = today?.some((t) => t.period === period);

  async function handleSave() {
    if (!mood || !anxiety || !energy) return;
    await logMood({ mood, anxiety, energy, note });
    setMood(null);
    setAnxiety(null);
    setEnergy(null);
    setNote('');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <section className="screen">
      <h1>Humor</h1>

      <div className="card">
        <p className="muted">Registro de {period === 'manha' ? 'manhã' : 'fim de tarde'}</p>
        {alreadyLogged && <p className="muted">Já registrado neste período. Pode registrar de novo se quiser.</p>}

        <ScaleInput label="Humor" value={mood} onChange={setMood} />
        <ScaleInput label="Ansiedade" value={anxiety} onChange={setAnxiety} />
        <ScaleInput label="Energia" value={energy} onChange={setEnergy} />

        <input
          className="text-input"
          placeholder="Contexto (opcional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={{ marginTop: 12 }}
        />

        <button className="big-button primary" onClick={handleSave} style={{ marginTop: 12 }}>
          {saved ? 'Salvo' : 'Salvar'}
        </button>
      </div>

      <h2 style={{ marginTop: 32 }}>Últimos registros</h2>
      <div className="card">
        {!recent || recent.length === 0 ? (
          <p className="muted">Sem registros ainda.</p>
        ) : (
          <table className="simple-table">
            <thead>
              <tr>
                <td>Data</td>
                <td>Hora</td>
                <td>Humor</td>
                <td>Ansiedade</td>
                <td>Energia</td>
              </tr>
            </thead>
            <tbody>
              {recent.slice().reverse().map((l) => (
                <tr key={l.id}>
                  <td>{formatDateShort(l.timestamp)}</td>
                  <td>{formatTime(l.timestamp)}</td>
                  <td>{l.mood}</td>
                  <td>{l.anxiety}</td>
                  <td>{l.energy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
