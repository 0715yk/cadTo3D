import type { GroupId, Vec3 } from './types'
import type { LifterParams } from './params'

export const GROUP_LABELS: Record<GroupId, string> = {
  base: '베이스 / 캐스터',
  mast: '마스트',
  liftDrive: '리프트 구동부',
  carriage: '크로스 헤드',
  spindleDrive: '스핀들 구동부',
  reel: '릴 (적재물)',
  pushHandle: '푸시 핸들',
  footBar: '풋 가드 바',
  panel: '조작 판넬',
}

/** Unit explode direction per group (mm at factor = 1). */
export const EXPLODE_VECTORS: Record<GroupId, Vec3> = {
  base: [0, -250, 0],
  mast: [0, 0, 0],
  liftDrive: [0, 450, 0],
  carriage: [350, 0, 0],
  spindleDrive: [-450, 0, 0],
  reel: [800, 0, 0],
  pushHandle: [0, 350, 350],
  footBar: [-300, -150, 0],
  panel: [0, 0, 400],
}

/** Groups that ride on the carriage and move with the lift stroke. */
export const LIFTED_GROUPS: readonly GroupId[] = ['carriage', 'spindleDrive', 'reel']

export const clamp01 = (t: number): number => Math.min(1, Math.max(0, t))

export const explodeOffset = (group: GroupId, factor: number): Vec3 => {
  const f = clamp01(factor)
  const v = EXPLODE_VECTORS[group]
  return [v[0] * f, v[1] * f, v[2] * f]
}

/** Maps lift slider t ∈ [0,1] to Y offset within the stroke, 0 = drawn position. */
export const liftOffset = (t: number, p: LifterParams): number => {
  const [lo, hi] = p.liftStroke
  return lo + (hi - lo) * clamp01(t)
}

/** Slider position that corresponds to the as-drawn pose (offset 0). */
export const liftRestT = (p: LifterParams): number => {
  const [lo, hi] = p.liftStroke
  return hi === lo ? 0 : (0 - lo) / (hi - lo)
}

export const reelAngle = (timeSec: number, rpm: number): number => (timeSec * rpm * 2 * Math.PI) / 60

export interface PoseState {
  readonly explode: number
  readonly lift: number
  readonly reelAngle: number
}

export const groupTranslation = (group: GroupId, state: PoseState, p: LifterParams): Vec3 => {
  const e = explodeOffset(group, state.explode)
  const lift = LIFTED_GROUPS.includes(group) ? liftOffset(state.lift, p) : 0
  return [e[0], e[1] + lift, e[2]]
}
