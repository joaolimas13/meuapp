import { useSyncExternalStore } from 'react'
import { CONFIG } from './config'

/*
  AJUSTES DE APARÊNCIA (por aparelho)
  -----------------------------------
  Ficam no localStorage deste navegador, porque a tela do projetor e o celular
  devem poder ter configurações diferentes (brilho, tamanho da letra etc.).
*/
export type ThemeName = 'ciano' | 'horizon' | 'laranja'
export type LiteMode = 'auto' | 'on' | 'off'

export interface Appearance {
  theme: ThemeName
  /** Modo noturno automático: hora de início e de fim (0–23). */
  nightStart: number
  nightEnd: number
  /** Brilho da tela em % (40–100). */
  brightness: number
  /** Tamanho das letras em % (85–150). */
  fontScale: number
  /** Modo leve (menos efeitos): automático detecta tela/PC lento. */
  lite: LiteMode
  /** Segundos sem mexer até o modo ambiente. */
  ambientSec: number
}

export const DEFAULT_APPEARANCE: Appearance = {
  theme: 'ciano',
  nightStart: CONFIG.nightStartHour,
  nightEnd: CONFIG.nightEndHour,
  brightness: 100,
  fontScale: 100,
  lite: 'auto',
  ambientSec: CONFIG.ambientAfterSec,
}

const KEY = 'gaia.appearance'
const clamp = (n: unknown, lo: number, hi: number, d: number) => (typeof n === 'number' && Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : d)

/** Valida o que veio do localStorage (pode estar velho ou mexido à mão). */
export function sanitize(raw: unknown): Appearance {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const d = DEFAULT_APPEARANCE
  return {
    theme: o.theme === 'horizon' || o.theme === 'laranja' || o.theme === 'ciano' ? o.theme : d.theme,
    nightStart: clamp(o.nightStart, 0, 23, d.nightStart),
    nightEnd: clamp(o.nightEnd, 0, 23, d.nightEnd),
    brightness: clamp(o.brightness, 40, 100, d.brightness),
    fontScale: clamp(o.fontScale, 85, 150, d.fontScale),
    lite: o.lite === 'on' || o.lite === 'off' || o.lite === 'auto' ? o.lite : d.lite,
    ambientSec: clamp(o.ambientSec, 15, 3600, d.ambientSec),
  }
}

function load(): Appearance {
  try {
    return sanitize(JSON.parse(localStorage.getItem(KEY) ?? 'null'))
  } catch {
    return DEFAULT_APPEARANCE
  }
}

let current = load()
const listeners = new Set<() => void>()

export function setAppearance(patch: Partial<Appearance>) {
  current = sanitize({ ...current, ...patch })
  try {
    localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    /* sem localStorage: vale só até recarregar */
  }
  listeners.forEach((l) => l())
}

export const resetAppearance = () => setAppearance(DEFAULT_APPEARANCE)

export function useAppearance(): Appearance {
  return useSyncExternalStore(
    (cb) => (listeners.add(cb), () => listeners.delete(cb)),
    () => current,
  )
}
