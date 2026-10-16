// Reference rate (2026-10-16), not a live quote. Deployments may override it.
const configuredRate = Number(import.meta.env.VITE_USD_JPY_RATE)
export const usdJpyRate = Number.isFinite(configuredRate) && configuredRate > 0 ? configuredRate : 158.16
export function formatYen(usd: number) { return (usd * usdJpyRate).toFixed(2) }
