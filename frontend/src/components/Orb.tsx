import { useEffect, useRef } from 'react'
import type { OrbState } from '../../../shared/types'

/*
  ORBE CENTRAL DO GAIA
  --------------------
  Desenhado em <canvas> 2D (mais leve que WebGL, roda bem em hardware modesto).
  Todo o desenho acontece dentro de um loop requestAnimationFrame e NÃO usa
  estado do React por frame — assim a animação não causa re-renders.
  As props ficam em um "ref" que o loop lê a cada quadro.
*/

type RGB = [number, number, number]
const TAU = Math.PI * 2

// Cor de cada estado (dia / noite). A cor muda suavemente entre estados.
const PALETTE_DAY: Record<OrbState, RGB> = {
  idle: [0, 229, 255],
  listening: [61, 245, 168],
  thinking: [140, 150, 255],
  speaking: [110, 240, 255],
  alert: [255, 179, 0],
}
const PALETTE_NIGHT: Record<OrbState, RGB> = {
  idle: [255, 154, 60],
  listening: [255, 190, 110],
  thinking: [220, 140, 90],
  speaking: [255, 200, 130],
  alert: [255, 110, 40],
}

// Comportamento da animação de cada estado.
interface Motion {
  spin: number // velocidade dos anéis
  breathHz: number // frequência da "respiração"
  breathAmp: number // intensidade da respiração
  wave: number // altura das barras do visualizador de voz
  think: number // 0..1 arco "processando"
  alert: number // 0..1 ondas de alerta
}
const MOTION: Record<OrbState, Motion> = {
  idle: { spin: 1, breathHz: 0.22, breathAmp: 0.03, wave: 0.05, think: 0, alert: 0 },
  listening: { spin: 1.4, breathHz: 0.7, breathAmp: 0.05, wave: 0.4, think: 0, alert: 0 },
  thinking: { spin: 3.2, breathHz: 1.2, breathAmp: 0.04, wave: 0.1, think: 1, alert: 0 },
  speaking: { spin: 1.8, breathHz: 0.9, breathAmp: 0.05, wave: 0.7, think: 0, alert: 0 },
  alert: { spin: 2.2, breathHz: 2, breathAmp: 0.1, wave: 0.15, think: 0, alert: 1 },
}

interface Props {
  state: OrbState
  night: boolean
  /** 1 = modo ativo, 0 = modo ocioso (orbe menor e mais discreto). */
  dim: number
  /** Modo leve: menos partículas e 30 fps. */
  lite: boolean
  /** Muda a cada "despertar" para disparar a onda de ativação. */
  wakeKey: number
}

export function Orb({ state, night, dim, lite, wakeKey }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const propsRef = useRef({ state, night, dim, lite })
  const wakeRef = useRef(-1) // segundos desde o despertar (-1 = sem animação)

  useEffect(() => {
    propsRef.current = { state, night, dim, lite }
  }, [state, night, dim, lite])

  useEffect(() => {
    if (wakeKey > 0) wakeRef.current = 0
  }, [wakeKey])

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    let w = 0
    let h = 0
    let dpr = 1

    // Ajusta a resolução do canvas ao tamanho real na tela (nítido em 4K).
    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = rect.width
      h = rect.height
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    // Partículas orbitando o núcleo.
    const particles = Array.from({ length: 70 }, () => ({
      r: 0.3 + Math.random() * 0.65,
      a: Math.random() * TAU,
      s: (0.05 + Math.random() * 0.2) * (Math.random() < 0.5 ? -1 : 1),
      size: 0.6 + Math.random() * 1.6,
      tw: Math.random() * TAU,
    }))

    // Valores "atuais" que se aproximam suavemente do alvo de cada estado.
    const color: RGB = [...PALETTE_DAY.idle]
    const cur: Motion = { ...MOTION.idle }
    let dimCur = 1

    let raf = 0
    let last = performance.now()
    let lastDraw = 0
    let t = 0

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      if (document.hidden) return
      const p = propsRef.current
      if (p.lite && now - lastDraw < 33) return // ~30 fps no modo leve
      lastDraw = now

      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      t += dt
      const k = 1 - Math.exp(-dt * 3) // suavização independente de fps

      // Aproxima cor e movimento do alvo do estado atual.
      const target = (p.night ? PALETTE_NIGHT : PALETTE_DAY)[p.state]
      for (let i = 0; i < 3; i++) color[i] += (target[i] - color[i]) * k
      const m = MOTION[p.state]
      cur.spin += (m.spin - cur.spin) * k
      cur.breathHz += (m.breathHz - cur.breathHz) * k
      cur.breathAmp += (m.breathAmp - cur.breathAmp) * k
      cur.wave += (m.wave - cur.wave) * k
      cur.think += (m.think - cur.think) * k
      cur.alert += (m.alert - cur.alert) * k
      dimCur += (p.dim - dimCur) * k

      const alphaMul = 0.35 + 0.65 * dimCur
      const [r, g, b] = color
      const rgba = (a: number) => `rgba(${r | 0},${g | 0},${b | 0},${Math.min(a * alphaMul, 1)})`

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'lighter' // soma luz = efeito de brilho
      ctx.lineCap = 'round'

      const cx = w / 2
      const cy = h / 2
      const R = (Math.min(w, h) / 2) * 0.95 * (0.78 + 0.22 * dimCur)
      const breath = 1 + cur.breathAmp * Math.sin(t * TAU * cur.breathHz)

      // --- Núcleo: brilho radial + ponto branco ---
      const coreR = R * 0.2 * breath
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 2.4)
      grad.addColorStop(0, rgba(0.95))
      grad.addColorStop(0.35, rgba(0.35))
      grad.addColorStop(1, rgba(0))
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(cx, cy, coreR * 2.4, 0, TAU)
      ctx.fill()
      ctx.fillStyle = `rgba(255,255,255,${0.55 * alphaMul})`
      ctx.beginPath()
      ctx.arc(cx, cy, coreR * 0.35, 0, TAU)
      ctx.fill()

      // --- Anéis concêntricos giratórios (tracejados) ---
      const rings = [
        { r: 0.4, dash: [R * 0.18, R * 0.05], speed: 0.25, lw: 2 },
        { r: 0.55, dash: [R * 0.5, R * 0.08, R * 0.05, R * 0.08], speed: -0.18, lw: 1.5 },
        { r: 0.7, dash: [R * 0.9, R * 0.12], speed: 0.1, lw: 1.2 },
        { r: 0.86, dash: [2, 6], speed: -0.05, lw: 1 },
      ]
      for (const ring of rings) {
        ctx.save()
        ctx.translate(cx, cy)
        ctx.rotate(t * ring.speed * cur.spin * TAU * 0.5)
        ctx.setLineDash(ring.dash)
        ctx.lineWidth = ring.lw
        ctx.strokeStyle = rgba(0.7)
        ctx.beginPath()
        ctx.arc(0, 0, R * ring.r * breath, 0, TAU)
        ctx.stroke()
        ctx.restore()
      }
      ctx.setLineDash([])

      // --- Marcas (tick marks) no anel externo ---
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(t * 0.03)
      ctx.strokeStyle = rgba(0.4)
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let i = 0; i < 72; i++) {
        const a = (i / 72) * TAU
        const long = i % 6 === 0
        const r0 = R * 0.93
        const r1 = R * (long ? 1.0 : 0.97)
        ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0)
        ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1)
      }
      ctx.stroke()
      ctx.restore()

      // --- Visualizador de voz: barras radiais ---
      // Na Fase 5 a amplitude virá do áudio real; aqui é simulada com senoides.
      const bars = lite_bars(p.lite)
      ctx.strokeStyle = rgba(0.85)
      ctx.lineWidth = 2
      ctx.beginPath()
      const r0 = R * 0.3 * breath
      for (let i = 0; i < bars; i++) {
        const a = (i / bars) * TAU + t * 0.1
        const wob = 0.5 + 0.5 * Math.sin(i * 0.35 + t * 6) * Math.sin(i * 0.13 - t * 3.1)
        const noise = 0.6 + 0.4 * Math.sin(t * 9 + i * 1.7)
        const len = R * (0.03 + cur.wave * 0.22 * wob * noise)
        ctx.moveTo(Math.cos(a) * r0 + cx, Math.sin(a) * r0 + cy)
        ctx.lineTo(Math.cos(a) * (r0 + len) + cx, Math.sin(a) * (r0 + len) + cy)
      }
      ctx.stroke()

      // --- Pensando: arco "cometa" girando ---
      if (cur.think > 0.02) {
        ctx.strokeStyle = rgba(0.9 * cur.think)
        ctx.lineWidth = 3
        ctx.beginPath()
        const a0 = t * 4
        ctx.arc(cx, cy, R * 0.62, a0, a0 + 1.3)
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(cx, cy, R * 0.48, -a0 * 0.8, -a0 * 0.8 + 0.9)
        ctx.stroke()
      }

      // --- Alerta: ondas que se expandem ---
      if (cur.alert > 0.02) {
        ctx.lineWidth = 2
        for (let n = 0; n < 3; n++) {
          const phase = (t * 1.1 + n / 3) % 1
          ctx.strokeStyle = rgba((1 - phase) * 0.7 * cur.alert)
          ctx.beginPath()
          ctx.arc(cx, cy, R * (0.3 + 0.7 * phase), 0, TAU)
          ctx.stroke()
        }
      }

      // --- Despertar: onda única de ativação ---
      if (wakeRef.current >= 0) {
        wakeRef.current += dt
        const f = wakeRef.current / 1.2
        if (f >= 1) wakeRef.current = -1
        else {
          ctx.strokeStyle = rgba((1 - f) * 0.9)
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.arc(cx, cy, R * (0.2 + 0.85 * f), 0, TAU)
          ctx.stroke()
        }
      }

      // --- Partículas ---
      const count = p.lite ? 25 : particles.length
      for (let i = 0; i < count; i++) {
        const pt = particles[i]
        pt.a += pt.s * dt * cur.spin * 0.5
        const x = cx + Math.cos(pt.a) * R * pt.r
        const y = cy + Math.sin(pt.a) * R * pt.r
        ctx.fillStyle = rgba(0.3 + 0.5 * Math.sin(t * 1.5 + pt.tw) ** 2)
        ctx.beginPath()
        ctx.arc(x, y, pt.size, 0, TAU)
        ctx.fill()
      }
    }

    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  return <canvas ref={canvasRef} className="block h-full w-full" aria-label="Orbe do GAIA" />
}

// Menos barras no modo leve.
function lite_bars(lite: boolean) {
  return lite ? 48 : 96
}
