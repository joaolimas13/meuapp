import { MEMORY_CATEGORIES, ORDER_CATEGORY } from '../../../shared/types'
import type { ToolDef } from '../ai/types'
import { nextStep } from '../db/tasksRepo'
import { localNow, norm } from '../lib/time'
import {
  asObj,
  BadRequest,
  optBool,
  optDue,
  optEnum,
  optNum,
  optStr,
  reqStr,
  steps,
  type Obj,
} from '../lib/validate'
import { describeTask } from '../planner'
import { dailyReview, planDay } from '../schedule'
import { checkinSummary, weeklyReview } from '../wellbeing'
import { addDays } from '../lib/time'
import type { Services } from '../services'

/*
  FERRAMENTAS DO GAIA
  -------------------
  Aqui está o que o GAIA consegue FAZER pela conversa. Cada ferramenta tem:
   - uma descrição (o que a IA lê para decidir quando usar);
   - um executor (o que realmente acontece no banco).
  `action` é o que aparece na tela como confirmação ("✔ Tarefa criada").
  Se algo estiver errado nos argumentos, devolvemos { error } para a IA corrigir ou explicar.
*/

export interface ToolOutcome {
  response: unknown
  action?: { ok: boolean; text: string }
}

const STEPS_SCHEMA = {
  type: 'array',
  description: 'Passos pequenos e concretos (5 a 15 min cada), do mais fácil para o mais difícil.',
  items: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'O que fazer neste passo.' },
      minutes: { type: 'integer', description: 'Minutos estimados (5 a 15).' },
    },
    required: ['title'],
  },
}

const DUE_DESC =
  'Prazo no horário local: "AAAA-MM-DD" (só o dia) ou "AAAA-MM-DDTHH:MM". Omita se a pessoa não deu prazo.'

export const TOOL_DEFS: ToolDef[] = [
  {
    name: 'create_task',
    description:
      'Cria uma tarefa (ou lembrete com horário) na lista. Para tarefa grande ou vaga, envie também "steps" já quebrada em passos.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Título curto da tarefa.' },
        due_at: { type: 'string', description: DUE_DESC },
        priority: { type: 'string', enum: ['high', 'normal', 'low'] },
        insistence: {
          type: 'string',
          enum: ['low', 'medium', 'max'],
          description: 'Quão insistente deve ser o lembrete (remédio = max; ideia solta = low).',
        },
        category: { type: 'string' },
        description: { type: 'string' },
        steps: STEPS_SCHEMA,
      },
      required: ['title'],
    },
  },
  {
    name: 'list_tasks',
    description: 'Lista as tarefas (com id) para consultar a agenda ou achar o id de uma tarefa.',
    parameters: {
      type: 'object',
      properties: { status: { type: 'string', enum: ['todo', 'done'], description: 'Padrão: todo (em aberto).' } },
    },
  },
  {
    name: 'complete_task',
    description: 'Marca uma tarefa (ou um passo) como concluída. Use o id; se não souber, passe parte do título.',
    parameters: {
      type: 'object',
      properties: { id: { type: 'integer' }, title: { type: 'string', description: 'Parte do título, se não tiver o id.' } },
    },
  },
  {
    name: 'add_task_steps',
    description: 'Quebra uma tarefa que já existe em passos pequenos, acrescentando os passos a ela.',
    parameters: {
      type: 'object',
      properties: { task_id: { type: 'integer' }, steps: STEPS_SCHEMA },
      required: ['task_id', 'steps'],
    },
  },
  {
    name: 'save_memory',
    description:
      'Guarda um fato duradouro sobre a pessoa ou o mundo dela (pessoas, preferências, projetos, rotina...) quando ela pede "lembra que...", "guarda isso".',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'O fato, em uma frase clara e autocontida.' },
        category: { type: 'string', enum: [...MEMORY_CATEGORIES] },
        tags: { type: 'array', items: { type: 'string' } },
        importance: { type: 'integer', description: '1 a 5. Use 5 só para o que deve estar SEMPRE presente.' },
      },
      required: ['text'],
    },
  },
  {
    name: 'search_memories',
    description: 'Procura nas memórias guardadas quando a pergunta depende de algo que a pessoa já contou.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string' }, category: { type: 'string', enum: [...MEMORY_CATEGORIES] } },
      required: ['query'],
    },
  },
  {
    name: 'capture_inbox',
    description:
      'Captura rápida: salva uma anotação solta na Caixa de Entrada, sem perguntar nada. Use quando a pessoa disser "anota...", "anota aí..." sem prazo nem categoria.',
    parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  },
  {
    name: 'log_day',
    description:
      'Registra no diário de desenvolvimento pessoal do dia: sono, páginas lidas, água, exercício, estudo. Envie só o que a pessoa informou.',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'AAAA-MM-DD. Padrão: hoje.' },
        sleep_hours: { type: 'number', description: 'Horas dormidas.' },
        pages: { type: 'integer', description: 'Páginas lidas hoje (total do dia, não só o que falta).' },
        water_liters: { type: 'number', description: 'Total de água bebida hoje, em litros.' },
        exercised: { type: 'boolean' },
        exercise_note: { type: 'string', description: 'Qual atividade (ex.: corrida 5 km).' },
        studied: { type: 'boolean' },
        study_hours: { type: 'number' },
      },
    },
  },
  {
    name: 'add_goal',
    description: 'Cria uma meta: "fixed" repete todos os dias; "daily" vale só para um dia.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        kind: { type: 'string', enum: ['fixed', 'daily'] },
        date: { type: 'string', description: 'Para metas diárias: AAAA-MM-DD. Padrão: hoje.' },
      },
      required: ['title', 'kind'],
    },
  },
  {
    name: 'create_order',
    description: 'Registra um pedido de cliente do negócio de impressão 3D, só para lembrar do prazo de entrega (o GAIA avisa no dia anterior e no dia). Finanças ficam em outro app.',
    parameters: {
      type: 'object',
      properties: {
        client: { type: 'string', description: 'Nome do cliente.' },
        item: { type: 'string', description: 'O que foi pedido.' },
        due_at: { type: 'string', description: 'Prazo de entrega: "AAAA-MM-DD" (ou com horário "AAAA-MM-DDTHH:MM").' },
      },
      required: ['client', 'item', 'due_at'],
    },
  },
  {
    name: 'add_content_idea',
    description: 'Guarda uma ideia de conteúdo para o Instagram (Reel, post ou story) no banco de ideias, ou no calendário se houver data.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'A ideia.' },
        product: { type: 'string', description: 'Produto relacionado (opcional).' },
        kind: { type: 'string', enum: ['reel', 'post', 'story'] },
        date: { type: 'string', description: 'Dia planejado AAAA-MM-DD (opcional; sem data vai para o banco de ideias).' },
      },
      required: ['title'],
    },
  },
  {
    name: 'where_was_i',
    description: 'Diz onde a pessoa parou: o último ponto de retomada salvo e o bloco de foco em andamento. Use quando ela perguntar "onde eu parei?".',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'save_bridge',
    description: 'Guarda onde a pessoa parou e qual é o próximo passo, para retomar depois. Use quando ela disser que vai interromper algo.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'O que estava fazendo.' },
        note: { type: 'string', description: 'Onde parou (opcional).' },
        next_step: { type: 'string', description: 'O que vinha em seguida (opcional).' },
      },
      required: ['title'],
    },
  },
  {
    name: 'plan_day',
    description: 'Sugere a ordem e os horários das tarefas do dia (blocos de tempo). Só sugere: a pessoa aprova e ajusta.',
    parameters: { type: 'object', properties: { date: { type: 'string', description: 'AAAA-MM-DD. Omita para hoje.' } } },
  },
  {
    name: 'daily_review',
    description: 'Resumo do dia: o que foi feito, o que ficou para remarcar e o que olhar amanhã.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'add_study_cards',
    description: 'Cria cartões de revisão espaçada (pergunta e resposta curtas) sobre o que a pessoa estudou, para o GAIA perguntar nos dias seguintes.',
    parameters: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Assunto (ex.: "Hidráulica").' },
        cards: { type: 'array', description: 'Cartões de pergunta e resposta.', items: { type: 'object', properties: { question: { type: 'string' }, answer: { type: 'string' } }, required: ['question', 'answer'] } },
      },
      required: ['cards'],
    },
  },
  {
    name: 'save_vault_idea',
    description: 'Guarda uma ideia ou projeto futuro no cofre (para revisar com calma depois), sem virar tarefa agora.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        notes: { type: 'string', description: 'Detalhes (opcional).' },
        kind: { type: 'string', enum: ['ideia', 'projeto'] },
      },
      required: ['title'],
    },
  },
  {
    name: 'log_checkin',
    description: 'Registra como a pessoa está agora: energia e humor de 1 (baixo) a 5 (alto).',
    parameters: {
      type: 'object',
      properties: { energy: { type: 'number' }, mood: { type: 'number' }, note: { type: 'string' } },
      required: ['energy', 'mood'],
    },
  },
  {
    name: 'weekly_review',
    description: 'Revisão da semana (últimos 7 dias): o que foi concluído, o que remarcar e o que priorizar na próxima.',
    parameters: { type: 'object', properties: {} },
  },
]

const fail = (text: string, error = text): ToolOutcome => ({ response: { error }, action: { ok: false, text } })

/** Executa uma ferramenta pedida pela IA. Nunca lança: erros viram resposta para a IA. */
export function runTool(name: string, rawArgs: unknown, s: Services): ToolOutcome {
  try {
    return execute(name, asObj(rawArgs), s)
  } catch (err) {
    if (err instanceof BadRequest) return fail(`Não consegui: ${err.message}`, err.message)
    console.error(`Erro na ferramenta ${name}:`, err instanceof Error ? err.message : err)
    return fail('Algo deu errado ao executar a ação.')
  }
}

function execute(name: string, a: Obj, s: Services): ToolOutcome {
  const now = s.local()
  switch (name) {
    case 'create_task': {
      const task = s.tasks.createWithSteps(
        {
          title: reqStr(a, 'title', 200),
          description: optStr(a, 'description', 2000),
          dueAt: optDue(a, 'due_at'),
          priority: optEnum(a, 'priority', ['high', 'normal', 'low'] as const),
          insistence: optEnum(a, 'insistence', ['low', 'medium', 'max'] as const),
          category: optStr(a, 'category', 60),
        },
        steps(a),
      )
      const n = task.steps.length
      return {
        response: { ok: true, id: task.id, title: task.title, due_at: task.dueAt, steps: n },
        action: { ok: true, text: `Tarefa criada: ${task.title}${n ? ` (${n} passos)` : ''}` },
      }
    }

    case 'list_tasks': {
      const status = optEnum(a, 'status', ['todo', 'done'] as const) ?? 'todo'
      const list = s.tasks.list({ status, limit: 25 })
      return { response: { tasks: list.map((t) => describeTask(t, now)), count: list.length } }
    }

    case 'complete_task': {
      let id = optNum(a, 'id', 1, Number.MAX_SAFE_INTEGER)
      if (id === undefined) {
        const q = norm(reqStr(a, 'title'))
        const open = s.tasks.list({ status: 'todo' })
        const pool = open.flatMap((t) => [t, ...t.steps.filter((x) => x.status === 'todo')])
        const matches = pool.filter((t) => norm(t.title).includes(q))
        if (matches.length === 0) return fail('Não achei essa tarefa em aberto.')
        if (matches.length > 1) {
          return {
            response: { error: 'Mais de uma tarefa combina. Pergunte qual.', candidates: matches.map((t) => describeTask(t, now)) },
            action: { ok: false, text: 'Mais de uma tarefa combina; preciso saber qual.' },
          }
        }
        id = matches[0].id
      }
      const r = s.tasks.complete(id)
      if (!r) return fail('Tarefa não encontrada.')
      const closed = r.parentDone ? ` (e a tarefa "${r.parentDone.title}" foi concluída)` : ''
      return {
        response: { ok: true, title: r.task.title, parent_done: r.parentDone?.title ?? null },
        action: { ok: true, text: `Concluída: ${r.task.title}${closed}` },
      }
    }

    case 'add_task_steps': {
      const id = optNum(a, 'task_id', 1, Number.MAX_SAFE_INTEGER)
      const list = steps(a)
      if (id === undefined || !list?.length) throw new BadRequest('Informe task_id e ao menos um passo.')
      if (!s.tasks.get(id)) return fail('Tarefa não encontrada.')
      s.tasks.addSteps(id, list)
      const t = s.tasks.get(id)!
      return {
        response: { ok: true, next_step: nextStep(t)?.title ?? null },
        action: { ok: true, text: `${list.length} passos adicionados a "${t.title}"` },
      }
    }

    case 'save_memory': {
      const m = s.memories.add({
        text: reqStr(a, 'text', 2000),
        category: optEnum(a, 'category', MEMORY_CATEGORIES),
        tags: Array.isArray(a.tags) ? a.tags.filter((t): t is string => typeof t === 'string').slice(0, 10) : [],
        importance: optNum(a, 'importance', 1, 5),
      })
      return { response: { ok: true, id: m.id }, action: { ok: true, text: 'Memória salva' } }
    }

    case 'search_memories': {
      const found = s.memories.search(reqStr(a, 'query', 200), { category: optEnum(a, 'category', MEMORY_CATEGORIES), limit: 8 })
      return { response: { memories: found.map((m) => ({ category: m.category, text: m.text })) } }
    }

    case 'capture_inbox': {
      s.inbox.add(reqStr(a, 'text', 1000))
      return { response: { ok: true }, action: { ok: true, text: 'Anotado na Caixa de Entrada' } }
    }

    case 'log_day': {
      const date = optStr(a, 'date', 10) ?? now.date
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BadRequest('"date" inválida: use AAAA-MM-DD.')
      const patch = {
        sleepHours: optNum(a, 'sleep_hours', 0, 24),
        pages: optNum(a, 'pages', 0, 5000),
        waterL: optNum(a, 'water_liters', 0, 20),
        exercised: optBool(a, 'exercised'),
        exerciseNote: optStr(a, 'exercise_note', 200),
        studied: optBool(a, 'studied'),
        studyHours: optNum(a, 'study_hours', 0, 24),
      }
      const given = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined))
      if (Object.keys(given).length === 0) throw new BadRequest('Nenhum dado para registrar.')
      s.dev.repo.saveLog(date, given)
      const score = s.dev.scoreFor(date).total
      return {
        response: { ok: true, date, score_so_far: score },
        action: { ok: true, text: `Registro do dia atualizado (nota ${score})` },
      }
    }

    case 'add_goal': {
      const kind = optEnum(a, 'kind', ['fixed', 'daily'] as const)
      if (!kind) throw new BadRequest('"kind" deve ser fixed ou daily.')
      const date = optStr(a, 'date', 10) ?? now.date
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BadRequest('"date" inválida: use AAAA-MM-DD.')
      const g = s.dev.repo.addGoal({ title: reqStr(a, 'title', 120), kind, date, createdOn: date })
      return {
        response: { ok: true, id: g.id },
        action: { ok: true, text: `Meta ${kind === 'fixed' ? 'fixa' : 'do dia'} criada: ${g.title}` },
      }
    }

    case 'create_order': {
      const due = optDue(a, 'due_at')
      if (!due) throw new BadRequest('"due_at" é obrigatório (prazo de entrega).')
      const client = reqStr(a, 'client', 80)
      const item = reqStr(a, 'item', 120)
      const t = s.tasks.create({ title: `Pedido · ${client} — ${item}`, dueAt: due, category: ORDER_CATEGORY, insistence: 'max', priority: 'high' })
      return { response: { ok: true, id: t.id, due_at: due }, action: { ok: true, text: `Pedido registrado: ${client} — ${item} (entrega ${due.slice(0, 10)})` } }
    }

    case 'add_content_idea': {
      const post = s.content.create({
        title: reqStr(a, 'title', 200),
        product: optStr(a, 'product', 100),
        kind: optEnum(a, 'kind', ['reel', 'post', 'story'] as const),
        date: optStr(a, 'date', 10) ?? null,
      })
      return { response: { ok: true, id: post.id }, action: { ok: true, text: `Ideia de conteúdo guardada: ${post.title}` } }
    }

    case 'where_was_i': {
      const bridge = s.focus.lastBridge()
      const focus = s.focus.current()
      return { response: { bridge, focus_em_andamento: focus ? { title: focus.title, started_at: focus.startedAt, minutes: focus.minutes } : null } }
    }

    case 'save_bridge': {
      const b = s.focus.addBridge({ taskId: null, title: reqStr(a, 'title', 200), note: optStr(a, 'note', 500) ?? '', nextStep: optStr(a, 'next_step', 300) ?? '' })
      return { response: { ok: true, id: b.id }, action: { ok: true, text: `Ponto de retomada salvo: ${b.title}` } }
    }

    case 'plan_day': {
      const plan = planDay(s.tasks.list({ status: 'todo' }), optStr(a, 'date', 10) ?? now.date, now, s.settings.general())
      return { response: plan }
    }

    case 'daily_review': {
      const doneToday = s.tasks.list({ status: 'done' }).filter((t) => t.parentId === null && t.completedAt && localNow(s.config.timezone, new Date(t.completedAt)).date === now.date)
      return { response: dailyReview(s.tasks.list({ status: 'todo' }), doneToday, now, s.dev.scoreFor(now.date).total) }
    }

    case 'add_study_cards': {
      const cards = Array.isArray(a.cards) ? a.cards.slice(0, 20) : []
      if (!cards.length) throw new BadRequest('Informe pelo menos um cartão.')
      const topic = optStr(a, 'topic', 80) ?? ''
      for (const c of cards) {
        const o = asObj(c)
        s.wellbeing.addCard({ topic, question: reqStr(o, 'question', 400), answer: reqStr(o, 'answer', 600) }, now.date)
      }
      return { response: { ok: true, created: cards.length }, action: { ok: true, text: `${cards.length} cartão(ões) de revisão criado(s)` } }
    }
    case 'save_vault_idea': {
      const item = s.wellbeing.addVault({ title: reqStr(a, 'title', 200), notes: optStr(a, 'notes', 1000) ?? '', kind: optEnum(a, 'kind', ['ideia', 'projeto'] as const) ?? 'ideia' })
      return { response: { ok: true, id: item.id }, action: { ok: true, text: `Guardado no cofre: ${item.title}` } }
    }
    case 'log_checkin': {
      const energy = optNum(a, 'energy', 1, 5)
      const mood = optNum(a, 'mood', 1, 5)
      if (!Number.isInteger(energy) || !Number.isInteger(mood)) throw new BadRequest('Energia e humor devem ser números de 1 a 5.')
      s.wellbeing.addCheckin({ date: now.date, time: now.time, energy: energy!, mood: mood!, note: optStr(a, 'note', 200) ?? '' })
      const sum = checkinSummary(s.wellbeing.checkinsBetween(addDays(now.date, -60), now.date), now)
      return { response: { ok: true, suggestion: sum.suggestion }, action: { ok: true, text: 'Check-in registrado' } }
    }
    case 'weekly_review':
      return { response: weeklyReview(s) }

    default:
      return fail(`Ferramenta desconhecida: ${name}`)
  }
}
