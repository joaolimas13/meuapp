# Arquitetura do GAIA

## Visão geral

```
Navegador (tela dedicada)            Servidor local (mini PC)
┌───────────────────────┐            ┌──────────────────────────────┐
│ Frontend (React/Vite) │  HTTP/SSE  │ Backend (Node + Fastify)     │
│  UI → hooks → serviços│◄──────────►│  rotas → serviços → banco    │
│  Orbe, painéis, voz   │            │  AIProvider (Gemini/Claude)  │
└───────────────────────┘            │  Agendador (lembretes)       │
                                     │  SQLite (dados locais)       │
                                     └──────────────────────────────┘
```

Camadas, de cima para baixo: **UI → hooks/estado → serviços → API → banco.** Cada camada só conversa com a vizinha, para dar para trocar peças sem quebrar o resto.

## Estrutura de pastas

```
gaia/
├── frontend/
│   └── src/
│       ├── components/   peças visuais (Orb, Panel, Clock, ...)
│       ├── hooks/        lógica reutilizável (relógio, modo ocioso, modo noturno)
│       ├── lib/          configuração e dados de exemplo
│       └── styles/       CSS global e variáveis do tema
├── backend/              (Fase 2 em diante)
│   └── src/
│       ├── ai/           interface AIProvider + Gemini, Claude, ...
│       ├── memory/       camada de memória (busca por texto; embeddings depois)
│       ├── tasks/        tarefas, lembretes, inbox
│       ├── scheduler/    agendador e lembretes escalonados
│       └── db/           esquema e migrações (SQL puro + SQLite)
├── shared/               tipos comuns (OrbState, Priority, ...)
└── docs/
```

## Decisões da Fase 1

- **Orbe em Canvas 2D, não Three.js.** Roda bem em hardware modesto e é mais simples de entender e ajustar. O orbe lê as props por um `ref` dentro do loop `requestAnimationFrame`, então a animação não provoca re-render do React. Se mais tarde você quiser algo 3D, só esse componente muda.
- **Tema por variáveis CSS.** Cores, brilho e fontes ficam em `styles/index.css`. O modo noturno só troca os valores das variáveis, sem mexer nos componentes.
- **Modo noturno e modo leve no `<html>`.** Assim o fundo da página também muda junto.
- **Tamanho de texto escalável.** O `html` usa `clamp()` para que tudo (em `rem`) cresça com a tela, legível à distância em 1080p e 4K.
- **Dados de exemplo isolados** em `lib/sampleData.ts`, para substituir pelo banco na Fase 3 sem tocar nos componentes.
- **Redução de sobrecarga e zero culpa já no visual:** "Meu dia" mostra no máximo 3 prioridades; atrasado vira "Remarcar?" em âmbar suave, nunca vermelho.

## Decisões da Fase 2

- **`AIProvider` isolado** (`backend/src/ai/`): o resto do sistema só conhece a interface. Gemini e um provedor de teste (`mock`) já existem; trocar para Claude é criar uma classe e um `case` em `ai/index.ts`.
- **Streaming por SSE** (`POST /api/chat`): o backend repassa a resposta aos poucos, em eventos `delta`, `done` e `error`. É mais simples que WebSocket e basta para o chat.
- **Chave só no backend.** O frontend nunca vê a chave; ela vai ao Gemini por cabeçalho (`x-goog-api-key`), não na URL.
- **SQLite com `better-sqlite3`**, atrás de um repositório (`db/chatRepo.ts`). Na Fase 3 mantive SQL puro (migrações versionadas por `PRAGMA user_version`) em vez de Drizzle: menos peças para aprender, e a troca continua possível porque tudo passa pelos repositórios.
- **Um servidor só em produção:** se `frontend/dist` existir, o backend serve a interface. É o que roda no netbook.
- **System prompt** em `ai/systemPrompt.ts`, com data/hora atuais e uma seção "limites desta versão" para o GAIA não fingir que criou tarefas ou lembretes.
- **Modelo padrão `gemini-3.8-flash`**, conferido na documentação do Google em 20/10/2026 (o 2.5 já está com acesso limitado). Configurável por `GEMINI_MODEL`.
- **Erros em português** na tela (chave inválida, limite de uso, sem internet, modelo não encontrado), em vez de falhas silenciosas.

## Plano para as próximas fases

| Fase | Entrega | Peças principais |
|------|---------|------------------|
| 2 ✔ | Chat com IA | Backend Fastify, `AIProvider`, streaming por SSE, system prompt do GAIA |
| 3 | Memória, tarefas, inbox | SQLite (SQL puro), tool calling, captura rápida, quebra de tarefas |
| 4 (feita) | Lembretes e foco | Agendador, lembretes escalonados, Modo Foco, âncoras, escala 24x72 |
| 5 (feita) | Voz | SpeechRecognition e SpeechSynthesis pt-BR, orbe reagindo ao áudio real |
| 6 | Negócio 3D | Kanban, clientes, orçamento, filamento, financeiro separado |
| 7 | Bem-estar | Streaks, check-in de energia, revisão semanal, estudos |
| 8 | Polimento | PWA, quiosque, backup/exportação, configurações |

## Pendências conhecidas da Fase 1

- Fontes (Orbitron, Rajdhani, Share Tech Mono) carregam do Google Fonts; sem internet o visual cai para fontes padrão. Na Fase 8 elas passam a ser empacotadas localmente.
- A palavra de ativação e o despertar por voz dependem da Fase 5; por enquanto o despertar é por mouse, toque ou teclado.
- PWA: já existe o `manifest`, mas falta o service worker (Fase 8).
