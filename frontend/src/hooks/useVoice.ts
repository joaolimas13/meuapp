import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import { parseVoice, type VoiceCommand } from '../../../shared/voiceCommands'
import { onSpeechChange, playCue, speech } from '../lib/sound'

// Tipos mínimos da Web Speech API (o TypeScript não traz por padrão).
interface SRResult { isFinal: boolean; 0: { transcript: string } }
interface SREvent { resultIndex: number; results: ArrayLike<SRResult> }
interface SR {
  lang: string; continuous: boolean; interimResults: boolean
  onresult: ((e: SREvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void; abort(): void
}
type SRCtor = new () => SR
const getSR = (): SRCtor | null => {
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export type VoiceMode = 'off' | 'passive' | 'active'
const ACTIVE_MS = 9000 // depois de "Gaia", quanto tempo espera o comando
const ERRORS: Record<string, string> = {
  'not-allowed': 'Microfone bloqueado: permita o acesso ao microfone no navegador.',
  'service-not-allowed': 'Reconhecimento de voz bloqueado neste navegador.',
  network: 'Sem internet: o reconhecimento de voz do navegador precisa de conexão.',
  'audio-capture': 'Nenhum microfone encontrado.',
}

interface Opts {
  /** True quando há um alerta na tela: aceita "feito / adiar / cancelar" sem dizer "Gaia". */
  bare: boolean
  onCommand: (cmd: VoiceCommand, raw: string) => void
}

/*
  ENTRADA DE VOZ
  --------------
  Escuta continuamente em pt-BR (Web Speech API). No modo passivo só reage a frases que começam
  com "Gaia"; dizer só "Gaia" abre uma janela de ~9 s em que a próxima frase é o comando.
  Enquanto o GAIA fala, o microfone pausa (senão ele ouviria a própria voz).
  Privacidade: no Chrome, o áudio vai para o serviço de reconhecimento do Google enquanto o mic está ligado.
*/
export function useVoice({ bare, onCommand }: Opts) {
  const supported = typeof window !== 'undefined' && !!getSR()
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem('gaia.voice.on') === '1' } catch { return false }
  })
  const [active, setActive] = useState(false)
  const [heard, setHeard] = useState('')
  const [error, setError] = useState<string | null>(null)
  const levelRef: MutableRefObject<number> = useRef(0)

  const enabledRef = useRef(enabled)
  const activeUntil = useRef(0)
  const optsRef = useRef({ bare, onCommand })
  optsRef.current = { bare, onCommand }
  const recRef = useRef<SR | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const persist = (on: boolean) => {
    enabledRef.current = on
    setEnabled(on)
    try { localStorage.setItem('gaia.voice.on', on ? '1' : '0') } catch { /* ignora */ }
  }

  const openWindow = useCallback(() => {
    activeUntil.current = Date.now() + ACTIVE_MS
    setActive(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setActive(false), ACTIVE_MS)
  }, [])

  const handleFinal = useCallback((text: string) => {
    const wakeRequired = Date.now() > activeUntil.current
    const cmd = parseVoice(text, { wakeRequired, bare: optsRef.current.bare })
    if (!cmd) return
    setHeard(text)
    if (cmd.type === 'wake') {
      playCue('wake')
      openWindow()
      return
    }
    clearTimeout(timer.current)
    activeUntil.current = 0
    setActive(false)
    optsRef.current.onCommand(cmd, text)
  }, [openWindow])

  // Ciclo de vida do reconhecedor.
  useEffect(() => {
    if (!enabled || !supported) return
    const SRc = getSR()!
    let dead = false
    let restart: ReturnType<typeof setTimeout> | undefined

    const begin = () => {
      if (dead || speech.speaking) return
      const rec = new SRc()
      rec.lang = 'pt-BR'
      rec.continuous = true
      rec.interimResults = true
      rec.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i]
          if (r.isFinal) handleFinal(r[0].transcript)
          else if (Date.now() <= activeUntil.current) setHeard(r[0].transcript)
        }
      }
      rec.onerror = (e) => {
        const msg = ERRORS[e.error]
        if (msg) {
          setError(msg)
          if (e.error !== 'network') persist(false) // sem permissão: não insiste
        }
      }
      rec.onend = () => {
        recRef.current = null
        if (!dead && enabledRef.current) restart = setTimeout(begin, 400) // o navegador encerra sozinho de tempos em tempos
      }
      recRef.current = rec
      try { rec.start(); setError(null) } catch { /* já estava ativo */ }
    }
    begin()

    // Pausa o microfone enquanto o GAIA fala; retoma depois.
    const off = onSpeechChange(() => {
      if (speech.speaking) recRef.current?.abort()
      else if (!recRef.current) restart = setTimeout(begin, 600)
    })
    return () => {
      dead = true
      off()
      clearTimeout(restart)
      recRef.current?.abort()
      recRef.current = null
    }
  }, [enabled, supported, handleFinal])

  // Amplitude para o orbe: microfone (analisador de áudio) ao ouvir, pulsos da voz ao falar.
  useEffect(() => {
    if (!enabled) { levelRef.current = 0; return }
    let stream: MediaStream | null = null
    let ac: AudioContext | null = null
    let analyser: AnalyserNode | null = null
    let buf: Uint8Array<ArrayBuffer> | null = null
    let cancelled = false
    // No Android o analisador disputa o microfone com o reconhecimento de voz: só no computador.
    const mobile = /Android|iPhone|iPad/i.test(navigator.userAgent)
    if (!mobile && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop())
        stream = s
        ac = new AudioContext()
        analyser = ac.createAnalyser()
        analyser.fftSize = 256
        ac.createMediaStreamSource(s).connect(analyser)
        buf = new Uint8Array(analyser.frequencyBinCount)
      }).catch(() => { /* sem visualizador: o resto funciona */ })
    }
    const t = setInterval(() => {
      let target = 0
      if (speech.speaking) {
        speech.level *= 0.85
        target = speech.level
      } else if (analyser && buf) {
        analyser.getByteTimeDomainData(buf)
        let sum = 0
        for (const v of buf) sum += ((v - 128) / 128) ** 2
        target = Math.min(1, Math.sqrt(sum / buf.length) * 5)
      }
      levelRef.current += (target - levelRef.current) * 0.5
    }, 50)
    return () => {
      cancelled = true
      clearInterval(t)
      stream?.getTracks().forEach((tr) => tr.stop())
      void ac?.close()
      levelRef.current = 0
    }
  }, [enabled])

  const toggle = useCallback(() => persist(!enabledRef.current), [])
  /** Botão "falar": liga o microfone (se preciso) e já abre a janela de comando. */
  const talk = useCallback(() => {
    if (!enabledRef.current) persist(true)
    playCue('wake')
    openWindow()
  }, [openWindow])

  const mode: VoiceMode = !enabled ? 'off' : active ? 'active' : 'passive'
  return { supported, mode, heard, error, toggle, talk, levelRef }
}
