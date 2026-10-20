export function ErrorLine({ msg }: { msg: string | null }) {
  return msg ? <div className="mono mb-2 text-sm" style={{ color: 'var(--amber)' }} role="alert">! {msg}</div> : null
}
