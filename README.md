# GAIA — assistente pessoal com interface HUD

Painel de comando pessoal para ficar ligado em uma tela dedicada, inspirado no J.A.R.V.I.S. e no GAIA de Horizon Zero Dawn.

**Status:** Fase 3 (chat com IA, memórias, tarefas, Caixa de entrada e Evolução pessoal). Lembretes sonoros, modo foco e voz entram nas próximas fases (veja `docs/arquitetura.md`).

## Privacidade

Os dados ficam **locais** no seu computador. Nada é enviado a terceiros, exceto as chamadas à API de IA que você escolher a partir da Fase 2. Chaves de API ficam apenas no `.env` do **backend**, nunca no código nem no frontend.

## Como rodar

Requisitos: Node.js 20 ou mais novo (recomendado 22 LTS).

**1. Instalar (uma vez):**

```bash
npm run install:all
```

**2. Configurar a IA:** copie `backend/.env.example` para `backend/.env` e preencha `GEMINI_API_KEY`. A chave fica **só** nesse arquivo (ele não vai para o git). Sem chave, use `AI_PROVIDER=mock` no `.env` para testar a interface com respostas de teste.

**3. Rodar, modo normal (um único servidor, o que vai no netbook):**

```bash
npm run build
npm start          # abre em http://127.0.0.1:8787
```

**Modo desenvolvimento** (dois terminais, recarrega sozinho ao editar):

```bash
npm run dev:backend    # http://127.0.0.1:8787
npm run dev:frontend   # http://localhost:5173
```

**Testes do backend:** `npm test`

Para acessar de outro aparelho da rede (ex.: iPad), use `HOST=0.0.0.0` no `.env`. Atenção: ainda não há senha, então só faça isso em rede de casa.

## Usando o chat

Clique em **Chat** ou pressione `C`. `Enter` envia, `Shift+Enter` quebra linha, `Esc` fecha. O orbe fica em "pensando" enquanto espera e em "falando" enquanto a resposta chega. O histórico fica salvo no banco local (`backend/data/gaia.sqlite`); o botão **Limpar** apaga. Nesta fase o GAIA só conversa: criar tarefas, lembretes e memórias vem na Fase 3.

## Teclas de teste do visual

Fora do campo de texto do chat:

| Tecla | O que faz |
|-------|-----------|
| `1` a `5` | Troca o estado do orbe: ocioso, ouvindo, pensando, falando, alerta |
| `N` | Alterna o modo noturno: automático (22h–6h), ligado, desligado |
| `L` | Liga/desliga o modo leve (menos partículas, 30 fps) |
| `C` | Abre/fecha o chat |
| `A` | Entra no modo ambiente na hora. Qualquer movimento do mouse, toque ou tecla desperta |

Sem interação por 90 segundos, a tela entra sozinha no modo ambiente.

## Modo quiosque (tela dedicada)

Com o Chrome, em Windows/Linux:

```bash
chrome --kiosk http://127.0.0.1:8787
```

Pressione `F11` para tela cheia em um navegador normal. O empacotamento completo (PWA instalável, início automático) vem na Fase 8.

## Estrutura

```
gaia/
├── frontend/   React + Vite + TypeScript + Tailwind + Framer Motion
├── backend/    Node + Fastify + SQLite + camada de IA (Gemini)
├── shared/     tipos TypeScript usados pelos dois lados
└── docs/       arquitetura e decisões
```

## O que ainda é exemplo

O chat já é real. Já os painéis "Meu dia", "Lembretes", "Negócio 3D" e o "Próximo compromisso" usam dados de exemplo (`frontend/src/lib/sampleData.ts`). Na Fase 3 eles passam a vir do banco de dados.

## Fase 3 — o que há de novo

**Painel lateral (abas):** `C` chat · `I` Caixa de entrada · `T` tarefas · `M` memórias · `E` evolução (as teclas não funcionam enquanto você digita; `Esc` fecha).

- **Caixa de entrada:** anote qualquer coisa na hora (sem categoria/prazo). Depois "Organizar com o GAIA" sugere tarefa ou memória; você aprova com um toque.
- **Tarefas:** prazo, prioridade, passos pequenos ("Quebrar" pede ao GAIA), atrasadas viram "Remarcar?" (sem lista vermelha). A tela principal mostra no máximo 3 prioridades.
- **Memórias:** buscar, filtrar, editar, fixar, apagar e exportar (JSON/Markdown).
- **Evolução:** atividade, estudo, páginas, sono, água e metas (fixas e do dia), com pontuação diária, sequência, nível e total de páginas lidas. Metas: sono 8 h, 30 páginas, 2 L de água. Pesos: metas 40, sono 20, exercício 15, estudo 15, leitura 10.
- **Ferramentas do GAIA no chat:** criar/listar/concluir tarefas, quebrar em passos, salvar/buscar memórias, anotar na Caixa, registrar o dia, criar metas.

**Privacidade:** com o provedor Gemini, a cada mensagem o GAIA envia à API do Google o histórico recente, memórias fixadas/relevantes e suas tarefas abertas, para responder com contexto.

**Modo de teste (`AI_PROVIDER=mock`):** comandos `/tarefa …`, `/memoria …`, `/anota …`.

**Ainda de exemplo:** o painel "Negócio 3D" (Fase 6). **Ainda não existe:** alerta sonoro/falado (Fases 4–5).

Testes: `npm test` (backend) — 46 testes.
