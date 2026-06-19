import { useState } from 'react';
import { parseSleepFile } from '../lib/sleepParser';
import { importSleepEntries, useRecentSleep } from '../hooks/useSleep';

const LOW_SLEEP_THRESHOLD_MIN = 6 * 60;

export default function SleepImport() {
  const recent = useRecentSleep();
  const [status, setStatus] = useState('');

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const entries = parseSleepFile(text);
      await importSleepEntries(entries);
      setStatus(`${entries.length} dia(s) importado(s).`);
    } catch (err) {
      setStatus(`Erro: ${err.message}`);
    }
    e.target.value = '';
  }

  const lastNight = recent && recent.length > 0 ? recent[recent.length - 1] : null;
  const lowSleep = lastNight?.raw?.totalSleepMinutes != null && lastNight.raw.totalSleepMinutes < LOW_SLEEP_THRESHOLD_MIN;

  return (
    <section className="screen">
      <h1>Sono e relógio</h1>

      <div className="card">
        <p className="muted">
          Importar JSON exportado do Zepp/Mi Fitness. Formato ainda não confirmado — campos ausentes são
          ignorados sem travar o app.
        </p>
        <label className="big-button">
          Selecionar arquivo
          <input type="file" accept="application/json" onChange={handleFile} style={{ display: 'none' }} />
        </label>
        {status && <p className="muted" style={{ marginTop: 8 }}>{status}</p>}
      </div>

      {lowSleep && (
        <div className="card card-warning">
          <p>Sono da última noite ficou abaixo de 6h. Vale ajustar a expectativa de rendimento hoje.</p>
        </div>
      )}

      <h2 style={{ marginTop: 32 }}>Últimos dias</h2>
      <div className="card">
        {!recent || recent.length === 0 ? (
          <p className="muted">Nenhum dado importado ainda.</p>
        ) : (
          <table className="simple-table">
            <thead>
              <tr>
                <td>Data</td>
                <td>Sono total</td>
                <td>Sono profundo</td>
                <td>Passos</td>
              </tr>
            </thead>
            <tbody>
              {recent.slice().reverse().map((s) => (
                <tr key={s.date}>
                  <td>{s.date}</td>
                  <td>{s.raw.totalSleepMinutes != null ? `${Math.round(s.raw.totalSleepMinutes / 60)}h` : '—'}</td>
                  <td>{s.raw.deepSleepMinutes != null ? `${Math.round(s.raw.deepSleepMinutes / 60)}h` : '—'}</td>
                  <td>{s.raw.steps ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
