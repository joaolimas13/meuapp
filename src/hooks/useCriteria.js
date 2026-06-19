import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { dateKey } from '../lib/dateUtils';

export const CRITERIA_DEFS = [
  { key: 'janela_ouro', label: 'Janela de ouro protegida (celular fora de alcance 11h–13h + tarefa avançada)' },
  { key: 'corpo_movido', label: 'Corpo movido (treino ou 30 min de caminhada)' },
  { key: 'manutencao', label: 'Tarefa de manutenção cumprida (pincel, reset do quarto, etc.)' },
];

export function useTodayCriteria() {
  const key = dateKey();
  const record = useLiveQuery(() => db.dailyCriteria.get(key), [key]);
  return record ?? { date: key, janela_ouro: false, corpo_movido: false, manutencao: false };
}

export async function toggleCriterion(criterionKey) {
  const key = dateKey();
  const current = (await db.dailyCriteria.get(key)) || { date: key };
  await db.dailyCriteria.put({ ...current, [criterionKey]: !current[criterionKey] });
}

export function allCriteriaMet(record) {
  return CRITERIA_DEFS.every((c) => record[c.key]);
}
