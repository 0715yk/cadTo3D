/** Demo cycle: dwell low → rise → dwell high → lower. Returns lift t ∈ [0,1]. */
export const DEMO_PERIOD_SEC = 10

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

export const demoLiftAt = (elapsedSec: number, period = DEMO_PERIOD_SEC): number => {
  const u = ((elapsedSec % period) + period) % period / period
  if (u < 0.1) return 0
  if (u < 0.45) return easeInOut((u - 0.1) / 0.35)
  if (u < 0.6) return 1
  return 1 - easeInOut((u - 0.6) / 0.4)
}
