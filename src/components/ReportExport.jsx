import { useState } from 'react';
import jsPDF from 'jspdf';
import { db } from '../db/db';
import { startOfDay, endOfDay, daysAgo, formatDateShort, formatTime } from '../lib/dateUtils';

const PERIODS = [
  { key: 7, label: 'Última semana' },
  { key: 30, label: 'Último mês' },
];

async function buildReportData(days) {
  const since = startOfDay(daysAgo(days));
  const until = endOfDay();

  const medication = await db.medicationLogs.where('timestamp').between(since, until, true, true).sortBy('timestamp');
  const mood = await db.moodLogs.where('timestamp').between(since, until, true, true).sortBy('timestamp');
  const sleep = (await db.sleepImports.toArray()).filter((s) => s.date >= formatDateShort(since));
  const criteria = (await db.dailyCriteria.toArray()).filter((c) => c.date >= formatDateShort(since));

  const goldenMetCount = criteria.filter((c) => c.janela_ouro).length;
  const goldenPct = criteria.length ? Math.round((goldenMetCount / criteria.length) * 100) : 0;

  return { medication, mood, sleep, criteria, goldenPct, days };
}

function renderPdf(data) {
  const doc = new jsPDF();
  let y = 15;

  doc.setFontSize(14);
  doc.text('Relatório de monitoramento', 10, y);
  y += 8;
  doc.setFontSize(10);
  doc.text(`Período: últimos ${data.days} dias`, 10, y);
  y += 10;

  doc.setFontSize(12);
  doc.text('Medicação', 10, y);
  y += 6;
  doc.setFontSize(9);
  data.medication.forEach((m) => {
    doc.text(`${formatDateShort(m.timestamp)} ${formatTime(m.timestamp)} - efeito: ${m.effectNote || 'não informado'}`, 10, y);
    y += 5;
  });
  if (data.medication.length === 0) {
    doc.text('Sem registros no período.', 10, y);
    y += 5;
  }

  y += 5;
  doc.setFontSize(12);
  doc.text('Humor / ansiedade / energia (escala 1-5)', 10, y);
  y += 6;
  doc.setFontSize(9);
  data.mood.forEach((m) => {
    doc.text(
      `${formatDateShort(m.timestamp)} ${formatTime(m.timestamp)} (${m.period}) - humor ${m.mood}, ansiedade ${m.anxiety}, energia ${m.energy}`,
      10,
      y
    );
    y += 5;
    if (y > 280) {
      doc.addPage();
      y = 15;
    }
  });
  if (data.mood.length === 0) {
    doc.text('Sem registros no período.', 10, y);
    y += 5;
  }

  y += 5;
  doc.setFontSize(12);
  doc.text('Sono (dados importados do relógio)', 10, y);
  y += 6;
  doc.setFontSize(9);
  data.sleep.forEach((s) => {
    const total = s.raw.totalSleepMinutes != null ? `${Math.round(s.raw.totalSleepMinutes / 60)}h` : 'não informado';
    doc.text(`${s.date} - sono total: ${total}`, 10, y);
    y += 5;
    if (y > 280) {
      doc.addPage();
      y = 15;
    }
  });
  if (data.sleep.length === 0) {
    doc.text('Sem dados de sono importados no período.', 10, y);
    y += 5;
  }

  y += 5;
  doc.setFontSize(12);
  doc.text('Janela de ouro', 10, y);
  y += 6;
  doc.setFontSize(9);
  doc.text(`Cumprida em ${data.goldenPct}% dos dias registrados no período.`, 10, y);
  y += 10;

  doc.setFontSize(8);
  doc.text('Documento gerado para acompanhamento profissional. Apresenta dados brutos, sem interpretação clínica.', 10, y);

  return doc;
}

export default function ReportExport() {
  const [busy, setBusy] = useState(false);

  async function handleExport(days) {
    setBusy(true);
    try {
      const data = await buildReportData(days);
      const doc = renderPdf(data);
      doc.save(`relatorio-${days}d-${formatDateShort(Date.now()).replace('/', '-')}.pdf`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="screen">
      <h1>Relatório</h1>
      <div className="card">
        <p className="muted">
          Gera um PDF com dados brutos (medicação, humor, sono, janela de ouro) para levar ao profissional de saúde.
          Não contém interpretação clínica.
        </p>
        {PERIODS.map((p) => (
          <button key={p.key} className="big-button" disabled={busy} onClick={() => handleExport(p.key)} style={{ marginTop: 12 }}>
            Exportar — {p.label}
          </button>
        ))}
      </div>
    </section>
  );
}
