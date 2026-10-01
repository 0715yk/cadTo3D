import type { Axis, Bounds, Shape, ShapeBox, ShapeCylinder, ShapeTorusArc, Vec3 } from './types'

export const box = (min: Vec3, max: Vec3): ShapeBox => ({ kind: 'box', min, max })

export const boxCentered = (center: Vec3, size: Vec3): ShapeBox =>
  box(
    [center[0] - size[0] / 2, center[1] - size[1] / 2, center[2] - size[2] / 2],
    [center[0] + size[0] / 2, center[1] + size[1] / 2, center[2] + size[2] / 2],
  )

export const cylinder = (axis: Axis, radius: number, start: Vec3, length: number, segments?: number): ShapeCylinder => ({
  kind: 'cylinder',
  axis,
  radius,
  start,
  length,
  ...(segments ? { segments } : {}),
})

/** Cylinder along X spanning [x0, x1] at (y, z). */
export const cylX = (radius: number, x0: number, x1: number, y: number, z: number, segments?: number) =>
  cylinder('x', radius, [x0, y, z], x1 - x0, segments)

/** Cylinder along Y spanning [y0, y1] at (x, z). */
export const cylY = (radius: number, y0: number, y1: number, x: number, z: number, segments?: number) =>
  cylinder('y', radius, [x, y0, z], y1 - y0, segments)

/** Cylinder along Z spanning [z0, z1] at (x, y). */
export const cylZ = (radius: number, z0: number, z1: number, x: number, y: number, segments?: number) =>
  cylinder('z', radius, [x, y, z0], z1 - z0, segments)

export const torusArc = (
  center: Vec3,
  majorRadius: number,
  tubeRadius: number,
  plane: ShapeTorusArc['plane'],
  startAngle: number,
  arc: number,
): ShapeTorusArc => ({ kind: 'torusArc', center, majorRadius, tubeRadius, plane, startAngle, arc })

const axisIndex: Record<Axis, number> = { x: 0, y: 1, z: 2 }

export const shapeBounds = (s: Shape): Bounds => {
  switch (s.kind) {
    case 'box':
      return { min: s.min, max: s.max }
    case 'cylinder': {
      const i = axisIndex[s.axis]
      const min = s.start.map((v, k) => (k === i ? v : v - s.radius)) as unknown as Vec3
      const max = s.start.map((v, k) => (k === i ? v + s.length : v + s.radius)) as unknown as Vec3
      return { min, max }
    }
    case 'torusArc': {
      const r = s.majorRadius + s.tubeRadius
      return {
        min: [s.center[0] - r, s.center[1] - r, s.center[2] - r],
        max: [s.center[0] + r, s.center[1] + r, s.center[2] + r],
      }
    }
  }
}

export const mergeBounds = (a: Bounds, b: Bounds): Bounds => ({
  min: [Math.min(a.min[0], b.min[0]), Math.min(a.min[1], b.min[1]), Math.min(a.min[2], b.min[2])],
  max: [Math.max(a.max[0], b.max[0]), Math.max(a.max[1], b.max[1]), Math.max(a.max[2], b.max[2])],
})

export const boundsOf = (shapes: readonly Shape[]): Bounds =>
  shapes.map(shapeBounds).reduce(mergeBounds)
