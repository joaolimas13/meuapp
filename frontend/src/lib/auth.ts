// Senha de acesso (GAIA_TOKEN). Fica só neste navegador (localStorage); nada vai para o código.
export const getToken = () => {
  try {
    return localStorage.getItem('gaia.token') ?? ''
  } catch {
    return ''
  }
}
export const setToken = (t: string) => {
  try {
    localStorage.setItem('gaia.token', t)
  } catch {
    /* ignora */
  }
}
/** Cabeçalhos de autenticação para as chamadas à API. */
export const authHeaders = (): Record<string, string> => {
  const t = getToken()
  return t ? { 'x-gaia-token': t } : {}
}
/** Para links que o navegador abre direto (exportação): leva o token na URL. */
export const withToken = (url: string) => {
  const t = getToken()
  return t ? `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(t)}` : url
}
export const UNAUTHORIZED_EVENT = 'gaia:unauthorized'
