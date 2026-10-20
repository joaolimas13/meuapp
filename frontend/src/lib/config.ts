// Configurações da interface. Na Fase 8 viram uma tela de Configurações.
// Por enquanto podem ser mudadas por variáveis VITE_* no arquivo frontend/.env

export const CONFIG = {
  /** Nome que o GAIA usa para te chamar. */
  userName: (import.meta.env.VITE_GAIA_USER_NAME as string | undefined) ?? 'JP',
  /** Segundos sem interação até entrar no modo ocioso (ambiente). */
  ambientAfterSec: Number(import.meta.env.VITE_GAIA_AMBIENT_AFTER_SEC ?? 90),
  /** Horário do modo noturno automático (24h). */
  nightStartHour: 22,
  nightEndHour: 6,
}
