import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { TokenGate } from './TokenGate'

interface SRLike {
  lang: string; continuous: boolean; interimResults: boolean
  onresult: ((e: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void; stop(): void
}

/*
  /captura — página para o celular: um botão de microfone enorme. Fala, solta, pronto.
  Cai direto na Caixa de entrada (sem categoria, sem prazo). Se o reconhecimento de voz do
  navegador não existir, o campo de texto funciona com o ditado do teclado do celular.
*/
export function CapturePage() {
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null)
  const recRef = useRef<SRLike | null>(null)
  const w = window as unknown as { SpeechRecognition?: new () => SRLike; webkitSpeechRecognition?: new () => SRLike }
  const SRc = w.SpeechRecognition ?? w.webkitSpeechRecognition

  // Faz "Adicionar à tela inicial" abrir direto nesta página (manifesto próprio).
  useEffect(() => {
    document.title = 'GAIA · Captura'
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
    if (link) link.href = '/captura.webmanifest'
  }, [])

  const save = async (t: string) => {
    const v = t.trim()
    if (!v) return
    try {
      await api.addInbox(v)
      setStatus({ ok: true, msg: '✔ Anotado' })
      setText('')
      navigator.vibrate?.(60)
    } catch (e) {
      setStatus({ ok: false, msg: (e as Error).message })
    }
  }

  const listen = () => {
    if (!SRc) return setStatus({ ok: false, msg: 'Este navegador não tem reconhecimento de voz. Use o microfone do teclado.' })
    if (listening) return recRef.current?.stop()
    const rec = new SRc()
    rec.lang = 'pt-BR'
    rec.continuous = false
    rec.interimResults = true
    let finalText = ''
    rec.onresult = (e) => {
      let t = ''
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript
      finalText = t
      setText(t)
    }
    rec.onerror = (e) => setStatus({ ok: false, msg: e.error === 'not-allowed' ? 'Permita o microfone no navegador.' : `Erro de voz: ${e.error}` })
    rec.onend = () => {
      setListening(false)
      if (finalText.trim()) void save(finalText) // salva sozinho ao terminar de falar
    }
    recRef.current = rec
    setStatus(null)
    setListening(true)
    rec.start()
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-6 text-center">
      <TokenGate />
      <div className="hud-title">GAIA · captura rápida</div>
      <button
        type="button"
        onClick={listen}
        aria-label={listening ? 'Parar de ouvir' : 'Falar'}
        className={listening ? 'pulse' : ''}
        style={{ width: '14rem', height: '14rem', borderRadius: '50%', border: '2px solid var(--cyan)', background: listening ? 'rgba(0,229,255,.18)' : 'rgba(0,229,255,.06)', color: 'var(--cyan)', fontSize: '4rem', boxShadow: 'var(--glow)' }}
      >
        {listening ? '■' : '🎙'}
      </button>
      <div style={{ color: 'var(--text-dim)' }}>{listening ? 'Ouvindo… fale e pare.' : 'Toque e fale. Salvo sozinho.'}</div>
      <div className="flex w-full max-w-md gap-2">
        <input className="hud-input flex-1" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save(text)} placeholder="…ou digite / dite pelo teclado" aria-label="Texto" />
        <button type="button" className="hud-btn primary" disabled={!text.trim()} onClick={() => save(text)}>Anotar</button>
      </div>
      {status && <div role="status" className="text-xl" style={{ color: status.ok ? 'var(--cyan)' : 'var(--amber)' }}>{status.msg}</div>}
    </div>
  )
}
