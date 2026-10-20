# GAIA — assistente pessoal com interface HUD

Painel de comando pessoal para ficar ligado em uma tela dedicada, inspirado no J.A.R.V.I.S. e no GAIA de Horizon Zero Dawn.

**Status:** v1.0 — Fase 8 (polimento) concluída, depois da Fase 7 (bem-estar e hábitos) e da Fase 6 enxuta (pedidos só como lembrete de prazo + calendário de conteúdo do Instagram). Finanças e gestão do negócio ficam em outro app, por escolha sua.

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

Pressione `F11` para tela cheia em um navegador normal. Há scripts prontos (`scripts/iniciar-gaia.sh` e `.bat`) e o passo a passo completo, com início automático e atualização, em [docs/quiosque.md](docs/quiosque.md).

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

## Fase 4 — o que há de novo

- **Lembretes escalonados:** tarefa com horário avisa discretamente 30/15/5 min antes (insistência média ou máxima). No horário a tela pulsa e toca um som (nível 1); aos 5 min o GAIA **fala** (nível 2); insistência máxima repete em intervalos crescentes (15, 30, 60, 120, 240 min) até você responder **Feito / Adiar 10 min / Cancelar**. A insistência é por tarefa: baixa (até 15 min), média (até 60), máxima (até 4 h). Depois disso para de insistir e a tarefa vira "Remarcar?".
- **Som e voz:** o navegador só libera áudio depois de **um toque ou tecla** na página. Em modo quiosque, dê um toque ao ligar o computador. Ligue/desligue som e voz na aba Rotina. A voz usa as vozes pt-BR do sistema (Web Speech).
- **Silêncio / Não perturbe:** das 23:00 às 06:00 (configurável) tudo fica só visual. Aba **Rotina**.
- **Modo Foco** (`F`): só a tarefa atual, o próximo passo e um timer (25/5, 50/10 ou 15/3). Ao fim do bloco: Terminei / Mais um bloco / Trocar. Trocar ou parar guarda **onde você parou** e o próximo passo.
- **Onde eu parei:** um cartão aparece na tela principal ("Você estava fazendo X, o próximo passo era Y. Retomamos?"). Também dá para perguntar ao GAIA no chat.
- **Âncoras de rotina** (aba Rotina): ao acordar, antes de sair, ao chegar, antes de dormir, com checklists editáveis e marcação por dia.
- **Dia** (`D`): plano sugerido com blocos de horário (tarefas com horário ficam fixas; as outras preenchem as lacunas) e revisão do dia, sem cobrança.
- **Escala em ciclo** (aba Rotina): ex.: 24h de trabalho / 72h de folga. Em dia de plantão o plano fica leve (no máximo 2 tarefas flexíveis).
- Novas ferramentas do GAIA no chat: onde parei, guardar ponto de retomada, plano do dia, revisão do dia.

**Limites conhecidos:** os alertas só tocam/falam com o painel aberto no navegador; sem reconhecimento de voz (microfone) até a Fase 5; as âncoras ainda não disparam sozinhas por horário (você abre o checklist quando o momento acontece).

Testes: `npm test` (backend) — 55 testes.

## Fase 5 — voz e captura pelo celular

### Voz no painel (computador)
- Tecla **`V`** (ou botão "Falar") liga o microfone. Passivo: só reage a frases que **começam com "Gaia"**. Dizer só "Gaia" abre ~9 s para o comando seguinte. Enquanto o GAIA fala, o mic pausa (senão ele ouve a própria voz).
- Comandos: **"Gaia, anota …"** (cai na Caixa de entrada na hora, sem perguntas) · **"feito / adiar / cancelar"** (soltos, sem "Gaia", quando há um alerta na tela) · **"Gaia, onde eu parei?"** · **"Gaia, modo foco"** / "sair do foco" · **"Gaia, abrir tarefas / caixa / dia / memórias / evolução / rotina"** · "Gaia, fechar". Qualquer outra frase vai para o chat e a resposta é **falada**.
- O orbe fica verde ao ouvir o comando e a amplitude do microfone/da voz move as barras do orbe (no Android o medidor do microfone fica desligado, para não disputar o mic).
- **Navegador:** use o **Chrome ou Edge** (Firefox não tem reconhecimento de voz). Funciona em `localhost`/`127.0.0.1` ou HTTPS.
- **Privacidade:** no Chrome o áudio do microfone vai para o serviço de reconhecimento do Google enquanto o mic está ligado. Desligue com `V` quando não quiser.

### Captura pelo celular: `/captura`
Página com um botão de microfone grande: toca, fala, **salva sozinha na Caixa de entrada**. No Chrome do Android: abra a página → menu ⋮ → **Adicionar à tela inicial**.

Para o celular alcançar o GAIA fora de casa (recomendado: **Tailscale**, gratuito e privado):
1. Instale o Tailscale no netbook e no celular, entrando com a mesma conta.
2. No `backend/.env` defina **`GAIA_TOKEN`** com uma frase longa (mínimo 16 caracteres). Sem isso qualquer aparelho da sua rede privada leria seus dados.
3. No netbook: `tailscale serve --bg 8787` (dá um endereço **HTTPS** tipo `https://netbook.xxxx.ts.net`; o Chrome só libera o microfone em HTTPS). Pode ser preciso ativar "HTTPS" e "MagicDNS" no painel do Tailscale.
4. No celular abra `https://netbook.xxxx.ts.net/captura`, digite o token uma vez e adicione à tela inicial.
O netbook precisa estar ligado e com internet.

**Segurança:** com `GAIA_TOKEN` definido toda a API exige o token (cabeçalho `x-gaia-token`). Se você usar `HOST=0.0.0.0`, o GAIA **recusa subir sem token**. Com `tailscale serve` o servidor continua em `127.0.0.1`, então **sempre defina o token** nesse caso.

**Não testado por mim:** Tailscale, o microfone real, as vozes do seu sistema e o Chrome do seu Android (testei com microfone e voz simulados e a página em um navegador de teste).

Testes: `npm test` (backend) — 62 testes.

## Fase 6 (versão enxuta) — Pedidos e Conteúdo

Por decisão sua, o módulo "Negócio 3D" completo (kanban, estoque, orçamento, financeiro) **não foi feito**: isso fica no seu outro app. O painel de exemplo foi removido.

- **Pedidos** (`P`): cliente + o que foi pedido + data de entrega. O GAIA avisa às **09:00 do dia anterior** e **09:00 do dia da entrega**, com a insistência máxima (som e voz, como os outros lembretes). **Entregue** conclui; **+1 dia** adia. Cada pedido é uma tarefa com categoria `pedido`, então também aparece em Tarefas e funciona por voz ("feito", "adiar").
- **Conteúdo** (`K`): calendário dos próximos 14 dias, **banco de ideias** (ideia sem data), tipo (reel/post/story), produto e **checklist de produção** (roteiro, gravação, edição, legenda, postado). Escolha os **dias de postagem** (padrão seg/qua/sex) e o horário do lembrete (padrão 10:00).
- **"Hoje é dia de postar"**: cartão na tela principal. No horário o GAIA avisa uma vez por dia por voz, se ainda não houver post marcado como postado. Sem cobrança: se não postou, o cartão só mostra o planejado.
- Pelo chat/voz: "registre o pedido da Maria, miniatura do gato, entrega dia 25" e "guarda a ideia de Reel do chaveiro".

Testes: `npm test` (backend) — 64 testes.

## Fase 7 — Bem-estar e hábitos

Tudo em tom de incentivo: nada vira lista vermelha de fracassos.

- **Check-in de energia e humor** (cartão "Bem-estar" no painel): 1 toque por nota, no máximo 2 convites por dia, em horário razoável (7h–22h). Com pelo menos 6 check-ins, o GAIA descobre seus **melhores horários** (blocos de 3 h) e sugere encaixar aí as tarefas difíceis. Gráfico na aba Evolução.
- **Sequências e pontos leves:** sequência de dias com a rotina (âncoras) completa, tarefas concluídas hoje/semana e pontos do dia. Se a sequência quebrar, a mensagem incentiva recomeçar.
- **Estudos [U]:** cartões de pergunta/resposta com **revisão espaçada** (caixas de 1, 3, 7, 14 e 30 dias: Errei volta ao início, Difícil repete, Acertei avança). Meta de horas por semana nas Configurações. Peça ao GAIA: "crie cartões sobre o que estudei".
- **Treinos:** plano semanal na aba Rotina. O GAIA cria a tarefa do treino no dia certo, uma vez só, e **não cria em dia de plantão**.
- **Sono e desaceleração:** na hora configurada (padrão 22:00) aparece "Hora de desacelerar", a tela entra no modo noturno e o checklist "antes de dormir" fica à mão.
- **Revisão semanal:** na aba Dia. Resumo do que concluiu, do que remarcar e do que priorizar. Lembrete automático no dia e hora configurados (padrão domingo 19:00).
- **Cofre de ideias e projetos [G]:** guarde sem pressa; **Executar** cria uma tarefa, **Adiar** e **Descartar** tiram do caminho. Uma vez por mês o GAIA lembra de revisar.
- **Voz e chat:** "Gaia, abrir estudos" / "abrir cofre"; ferramentas novas do chat: criar cartões, guardar no cofre, registrar check-in, revisão da semana.

Testes: `cd backend && npm test` (72 testes). Dados novos ficam no mesmo SQLite local (migração 5, automática).

## Fase 8 — Polimento (v1.0)

- **Aba Ajustes [S]** (valem só para o aparelho): tema (ciano, verde Horizon, laranja Horizon), brilho, tamanho das letras, horário do modo noturno, tempo até o modo ambiente e modo leve (automático, sempre ou nunca).
- **Modo leve automático:** se a tela rodar abaixo de ~28 quadros por segundo, o GAIA simplifica os efeitos sozinho (bom para o netbook).
- **Backup:** um por dia em `backend/data/backups/` (7 últimos) e downloads na aba Ajustes: tudo em JSON, memórias em Markdown, banco SQLite. Restaurar = trocar o arquivo `gaia.sqlite` (ver [docs/quiosque.md](docs/quiosque.md)).
- **App instalável (PWA):** ícones, manifesto e service worker; a interface abre mesmo se o backend estiver desligado (e avisa). Mantém a tela acesa (Wake Lock).
- **Quiosque:** scripts para Linux/Windows e serviço systemd em `scripts/`.

Testes: `cd backend && npm test` (75 testes).

