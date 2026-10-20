// Som e voz dos alertas. Navegadores só liberam áudio depois de UM toque/tecla na página
// (regra anti-propaganda). Por isso `unlockAudio` é chamado no primeiro clique/tecla.

let ctx: AudioContext | null = null
const prefs = { sound: true, voice: true }

try {
  const raw = localStorage.getItem('gaia.audio')
  if (raw) Object.assign(prefs, JSON.parse(raw))
} catch {
  /* sem localStorage: usa o padrão */
}

export const getAudioPrefs = () => ({ ...prefs })
export function setAudioPrefs(p: Partial<typeof prefs>) {
  Object.assign(prefs, p)
  try {
    localStorage.setItem('gaia.audio', JSON.stringify(prefs))
  } catch {
    /* ignora */
  }
}

export function unlockAudio() {
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    /* sem áudio disponível */
  }
}
export const audioReady = () => ctx?.state === 'running'

function tone(freq: number, start: number, dur: number, vol = 0.18) {
  if (!ctx) return
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = 'sine'
  o.frequency.value = freq
  g.gain.setValueAtTime(0, ctx.currentTime + start)
  g.gain.linearRampToValueAtTime(vol, ctx.currentTime + start + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur)
  o.connect(g).connect(ctx.destination)
  o.start(ctx.currentTime + start)
  o.stop(ctx.currentTime + start + dur + 0.05)
}

export type Cue = 'alert1' | 'alert2' | 'alert3' | 'done' | 'confirm' | 'wake'

/** Efeitos sutis: cada nível de alerta soa mais insistente. */
export function playCue(cue: Cue) {
  if (!prefs.sound || !ctx || ctx.state !== 'running') return
  switch (cue) {
    case 'alert1': tone(660, 0, 0.25); tone(880, 0.28, 0.35); break
    case 'alert2': tone(660, 0, 0.2); tone(880, 0.22, 0.2); tone(660, 0.44, 0.2); tone(880, 0.66, 0.4); break
    case 'alert3': for (let i = 0; i < 4; i++) { tone(880, i * 0.3, 0.14, 0.24); tone(1100, i * 0.3 + 0.15, 0.14, 0.24) } break
    case 'done': tone(523, 0, 0.15); tone(659, 0.15, 0.15); tone(784, 0.3, 0.3); break // recompensa ao concluir
    case 'confirm': tone(740, 0, 0.12); break
    case 'wake': tone(440, 0, 0.2); tone(660, 0.2, 0.3); break
  }
}

/** Fala em português do Brasil (Web Speech Synthesis). */
export function speak(text: string) {
  if (!prefs.voice || !('speechSynthesis' in window)) return
  try {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'pt-BR'
    u.rate = 1
    window.speechSynthesis.speak(u)
  } catch {
    /* sem voz disponível */
  }
}
