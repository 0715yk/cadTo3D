export type Pt = readonly [number, number]

interface Flags {
  readonly h?: 1
  readonly d?: 1
}
export type DrawingItem =
  | ({ readonly t: 'l'; readonly a: Pt; readonly b: Pt } & Flags)
  | ({ readonly t: 'c'; readonly c: Pt; readonly r: number } & Flags)
  | ({ readonly t: 'a'; readonly c: Pt; readonly r: number; readonly s: number; readonly e: number } & Flags)
  | ({ readonly t: 'p'; readonly pts: readonly number[] } & Flags)
  | ({ readonly t: 'f'; readonly pts: readonly number[] } & Flags)
  | ({ readonly t: 't'; readonly p: Pt; readonly s: string; readonly h: number } & Flags)

export interface Drawing2D {
  readonly meta: { readonly source: string; readonly version: string | null; readonly layers: readonly string[]; readonly entityCount: number }
  readonly extents: { readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number }
  readonly items: readonly DrawingItem[]
}

/** World(drawing mm, Y-up) ↔ screen transform. */
export interface View2D {
  readonly scale: number
  readonly tx: number
  readonly ty: number
}

export const fitView = (d: Drawing2D, width: number, height: number, margin = 24): View2D => {
  const { minX, minY, maxX, maxY } = d.extents
  const w = Math.max(1, maxX - minX)
  const h = Math.max(1, maxY - minY)
  const scale = Math.max(1e-6, Math.min((width - margin * 2) / w, (height - margin * 2) / h))
  const tx = (width - w * scale) / 2 - minX * scale
  const ty = (height + h * scale) / 2 + minY * scale
  return { scale, tx, ty }
}

export const toScreen = (v: View2D, x: number, y: number): Pt => [x * v.scale + v.tx, -y * v.scale + v.ty]

export const zoomAt = (v: View2D, sx: number, sy: number, factor: number): View2D => {
  const scale = Math.min(200, Math.max(0.01, v.scale * factor))
  const k = scale / v.scale
  return { scale, tx: sx - (sx - v.tx) * k, ty: sy - (sy - v.ty) * k }
}

export const panBy = (v: View2D, dx: number, dy: number): View2D => ({ ...v, tx: v.tx + dx, ty: v.ty + dy })
