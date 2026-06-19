import { useState } from 'react';
import './App.css';
import Dashboard from './components/Dashboard';
import MedicationLog from './components/MedicationLog';
import HabitChecklist from './components/HabitChecklist';
import MoodLog from './components/MoodLog';
import SleepImport from './components/SleepImport';
import ReportExport from './components/ReportExport';

const TABS = [
  { key: 'dashboard', label: 'Hoje', component: Dashboard },
  { key: 'medication', label: 'Remédio', component: MedicationLog },
  { key: 'habits', label: 'Hábitos', component: HabitChecklist },
  { key: 'mood', label: 'Humor', component: MoodLog },
  { key: 'sleep', label: 'Sono', component: SleepImport },
  { key: 'report', label: 'Relatório', component: ReportExport },
];

export default function App() {
  const [active, setActive] = useState('dashboard');
  const ActiveComponent = TABS.find((t) => t.key === active).component;

  return (
    <div id="app-shell">
      <main className="app-main">
        <ActiveComponent />
      </main>
      <nav className="bottom-nav">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`nav-button ${active === t.key ? 'nav-active' : ''}`}
            onClick={() => setActive(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
