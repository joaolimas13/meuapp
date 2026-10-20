import { isDate, isDue } from './time'

/** Erro de entrada inválida: vira resposta 400 (na API) ou erro legível para a IA (nas ferramentas). */
export class BadRequest extends Error {}

export type Obj = Record<string, unknown>

export const asObj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {})

export function reqStr(o: Obj, key: string, max = 300): string {
  const v = o[key]
  if (typeof v !== 'string' || v.trim() === '') throw new BadRequest(`"${key}" é obrigatório.`)
  if (v.length > max) throw new BadRequest(`"${key}" passa de ${max} caracteres.`)
  return v.trim()
}

export function optStr(o: Obj, key: string, max = 300): string | undefined {
  if (o[key] === undefined || o[key] === null) return undefined
  const v = o[key]
  if (typeof v !== 'string') throw new BadRequest(`"${key}" deve ser texto.`)
  if (v.length > max) throw new BadRequest(`"${key}" passa de ${max} caracteres.`)
  return v.trim()
}

export function optEnum<T extends string>(o: Obj, key: string, values: readonly T[]): T | undefined {
  const v = o[key]
  if (v === undefined || v === null) return undefined
  if (typeof v !== 'string' || !values.includes(v as T)) throw new BadRequest(`"${key}" deve ser um de: ${values.join(', ')}.`)
  return v as T
}

export function optNum(o: Obj, key: string, min: number, max: number): number | undefined {
  const v = o[key]
  if (v === undefined || v === null || v === '') return undefined
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) {
    throw new BadRequest(`"${key}" deve ser um número entre ${min} e ${max}.`)
  }
  return v
}

export function optBool(o: Obj, key: string): boolean | undefined {
  const v = o[key]
  if (v === undefined || v === null) return undefined
  if (typeof v !== 'boolean') throw new BadRequest(`"${key}" deve ser verdadeiro ou falso.`)
  return v
}

/** Prazo "AAAA-MM-DD" ou "AAAA-MM-DDTHH:MM". `null` explícito limpa o prazo. */
export function optDue(o: Obj, key: string): string | null | undefined {
  const v = o[key]
  if (v === undefined) return undefined
  if (v === null || v === '') return null
  if (!isDue(v)) throw new BadRequest(`"${key}" inválido: use AAAA-MM-DD ou AAAA-MM-DDTHH:MM.`)
  return v
}

export function optDate(o: Obj, key: string): string | undefined {
  const v = o[key]
  if (v === undefined || v === null) return undefined
  if (!isDate(v)) throw new BadRequest(`"${key}" inválida: use AAAA-MM-DD.`)
  return v
}

/** Lista de passos: [{ title, minutes? }] (até 20). */
export function steps(o: Obj, key = 'steps'): { title: string; minutes: number | null }[] | undefined {
  const v = o[key]
  if (v === undefined || v === null) return undefined
  if (!Array.isArray(v) || v.length > 20) throw new BadRequest(`"${key}" deve ser uma lista de até 20 passos.`)
  return v.map((s, i) => {
    const so = asObj(s)
    const title = typeof s === 'string' ? s.trim() : reqStr(so, 'title', 200)
    if (!title) throw new BadRequest(`Passo ${i + 1} sem título.`)
    return { title, minutes: typeof s === 'string' ? null : optNum(so, 'minutes', 1, 480) ?? null }
  })
}

export function parseId(raw: unknown): number {
  const n = Number(raw)
  if (!Number.isInteger(n) || n <= 0) throw new BadRequest('Id inválido.')
  return n
}
