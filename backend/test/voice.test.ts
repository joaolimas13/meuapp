import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseVoice, stripWake } from '../../shared/voiceCommands'

const P = (s: string, wake = true, bare = false) => parseVoice(s, { wakeRequired: wake, bare })

test('palavra de ativação: variações e ignorar o que não é para o GAIA', () => {
  assert.equal(stripWake('Gaia, anota comprar pão'), 'anota comprar pao')
  assert.equal(stripWake('ei Gaia'), '')
  assert.equal(stripWake('hoje o gaiato chegou'), null)
  assert.equal(P('que horas são'), null)
  assert.deepEqual(P('Gaia'), { type: 'wake' })
})

test('captura rápida mantém o texto original com acentos', () => {
  assert.deepEqual(P('Gaia, anota ligar para o dentista amanhã às 10h'), { type: 'capture', text: 'ligar para o dentista amanhã às 10h' })
  assert.deepEqual(P('gaia lembra que preciso comprar filamento'), { type: 'capture', text: 'preciso comprar filamento' })
  assert.deepEqual(P('anota aí ideia de brinde', false), { type: 'capture', text: 'ideia de brinde' })
  assert.deepEqual(P('Gaia guarda isso: orçamento do João'), { type: 'capture', text: 'orçamento do João' })
  // verbo sozinho, sem conteúdo: vai para o chat perguntar o que anotar
  assert.equal(P('Gaia anota')?.type, 'chat')
})

test('respostas a alertas: com "Gaia" ou soltas quando há alerta', () => {
  assert.deepEqual(P('Gaia, feito'), { type: 'alert', action: 'done' })
  assert.deepEqual(P('adiar', true, true), { type: 'alert', action: 'snooze' })
  assert.deepEqual(P('cancelar', true, true), { type: 'alert', action: 'cancel' })
  assert.equal(P('adiar', true, false), null) // sem alerta na tela e sem "Gaia": ignora
  assert.equal(P('feito', true, true)?.type, 'alert')
})

test('foco, onde parei, abrir painéis e conversa', () => {
  assert.deepEqual(P('Gaia onde eu parei?'), { type: 'where' })
  assert.deepEqual(P('gaia modo foco'), { type: 'focus', on: true })
  assert.deepEqual(P('gaia sair do foco'), { type: 'focus', on: false })
  assert.deepEqual(P('Gaia, abrir tarefas'), { type: 'open', tab: 'tasks' })
  assert.deepEqual(P('gaia mostra a evolução'), { type: 'open', tab: 'growth' })
  assert.deepEqual(P('gaia fechar'), { type: 'close' })
  assert.deepEqual(P('Gaia, quanto é 15% de 240?'), { type: 'chat', text: 'Gaia, quanto é 15% de 240?' })
  assert.deepEqual(P('quanto é 2 mais 2', false), { type: 'chat', text: 'quanto é 2 mais 2' })
})
