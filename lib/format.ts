export function formatBytes(value: unknown) {
  const bytes = Number(value)
  if (!Number.isFinite(bytes) || value === null) return "—"
  const units = ["B", "KiB", "MiB", "GiB", "TiB"]
  let i = 0
  let n = bytes
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(i ? 1 : 0)} ${units[i]}`
}

export function formatNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return "—"
  const n = Number(value)
  return Number.isFinite(n) ? n.toLocaleString("pt-BR") : String(value)
}

export function formatDuration(ms: number) {
  return ms < 1000 ? `${ms.toFixed(1)} ms` : `${(ms / 1000).toFixed(2)} s`
}
