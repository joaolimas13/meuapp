import { useHabitDefs, useTodayHabitLogs, toggleHabit, useHabitHistory, useGoldenWindowStreak } from '../hooks/useHabits';
import { dateKey, daysAgo } from '../lib/dateUtils';

function Heatmap({ history, weeks = 10 }) {
  if (!history) return null;
  const days = [];
  for (let i = weeks * 7 - 1; i >= 0; i--) {
    const d = daysAgo(i);
    const key = dateKey(d);
    days.push({ key, count: history[key] || 0 });
  }
  return (
    <div className="heatmap">
      {days.map((d) => (
        <div
          key={d.key}
          className="heatmap-cell"
          style={{ opacity: d.count === 0 ? 0.15 : Math.min(1, 0.3 + d.count * 0.15) }}
          title={`${d.key}: ${d.count} hábito(s)`}
        />
      ))}
    </div>
  );
}

export default function HabitChecklist() {
  const defs = useHabitDefs();
  const todayLogs = useTodayHabitLogs();
  const history = useHabitHistory();
  const streak = useGoldenWindowStreak();

  const doneKeys = new Set((todayLogs || []).map((l) => l.habitKey));

  return (
    <section className="screen">
      <h1>Hábitos</h1>

      <p className="muted">{streak} dia(s) seguidos protegendo a janela de ouro</p>

      <div className="card">
        {(defs || []).map((h) => (
          <label key={h.key} className="checkbox-row">
            <input type="checkbox" checked={doneKeys.has(h.key)} onChange={() => toggleHabit(h.key)} />
            <span>{h.label}</span>
          </label>
        ))}
      </div>

      <h2 style={{ marginTop: 32 }}>Histórico (10 semanas)</h2>
      <Heatmap history={history} />
    </section>
  );
}
