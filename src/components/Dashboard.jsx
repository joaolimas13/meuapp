import { useEffect, useState } from 'react';
import { useTodayMedicationLog } from '../hooks/useMedication';
import { useTodayCriteria, CRITERIA_DEFS, toggleCriterion, allCriteriaMet } from '../hooks/useCriteria';
import { getMedicationPhase, getPhaseLabel, getGoldenWindow, isGoldenWindowActive, msToCountdown } from '../lib/pharma';

const TIMELINE_BLOCKS = [
  { time: '07:00', label: 'Filho + café da manhã', category: 'filho' },
  { time: '09:00', label: 'Medicação', category: 'medicacao' },
  { time: '11:00', label: 'Janela de ouro', category: 'empresa' },
  { time: '13:00', label: 'Almoço + filho', category: 'refeicao' },
  { time: '14:30', label: 'Reset de 10 min', category: 'empresa' },
  { time: '19:30', label: 'Treino', category: 'treino' },
  { time: '20:30', label: 'Jantar leve', category: 'refeicao' },
  { time: '21:00', label: 'Desaceleração', category: 'sono' },
  { time: '22:30', label: 'Dormir', category: 'sono' },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function Dashboard() {
  const today = useTodayMedicationLog();
  const criteria = useTodayCriteria();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const phase = today ? getMedicationPhase(today.timestamp, now) : 'none';
  const golden = getGoldenWindow();
  const goldenActive = isGoldenWindowActive(now);
  const toGolden = golden.start - now;
  const metAll = allCriteriaMet(criteria);

  return (
    <section className="screen">
      <h1>{greeting()}, João Pedro</h1>

      <div className="card">
        <p className="muted">Status do medicamento</p>
        <p className="big-status">{getPhaseLabel(phase)}</p>
      </div>

      <div className={`card ${goldenActive ? 'card-highlight' : ''}`}>
        <p className="muted">Janela de ouro</p>
        {goldenActive ? (
          <p className="big-status">Ativa agora — celular fora de alcance</p>
        ) : toGolden > 0 ? (
          <p className="big-status">Começa em {msToCountdown(toGolden)}</p>
        ) : (
          <p className="big-status">Encerrada por hoje</p>
        )}
      </div>

      <h2>Linha do tempo</h2>
      <ol className="timeline">
        {TIMELINE_BLOCKS.map((b) => (
          <li key={b.time} className={`timeline-item cat-${b.category}`}>
            <span className="timeline-time">{b.time}</span>
            <span>{b.label}</span>
          </li>
        ))}
      </ol>

      <h2>Critérios mínimos do dia</h2>
      <div className="card">
        {CRITERIA_DEFS.map((c) => (
          <label key={c.key} className="checkbox-row">
            <input
              type="checkbox"
              checked={!!criteria[c.key]}
              onChange={() => toggleCriterion(c.key)}
            />
            <span>{c.label}</span>
          </label>
        ))}
        <p className={`reward-indicator ${metAll ? 'unlocked' : 'locked'}`}>
          {metAll ? 'Videogame liberado' : 'Videogame bloqueado'}
        </p>
      </div>
    </section>
  );
}
