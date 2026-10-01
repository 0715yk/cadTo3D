import { describe, expect, it } from 'vitest'
import { fitView, panBy, toScreen, zoomAt, type Drawing2D } from './drawing'

const drawing: Drawing2D = {
  meta: { source: 'x.dwg', version: null, layers: [], entityCount: 0 },
  extents: { minX: 0, minY: 0, maxX: 200, maxY: 100 },
  items: [],
}

describe('2d view transform', () => {
  it('fits extents into the canvas with margin', () => {
    const v = fitView(drawing, 440, 300, 20)
    expect(v.scale).toBeCloseTo(2)
    expect(toScreen(v, 0, 0)).toEqual([20, 250])
    expect(toScreen(v, 200, 100)).toEqual([420, 50])
  })
  it('zoom keeps the anchor point fixed', () => {
    const v = fitView(drawing, 440, 300)
    const anchor = toScreen(v, 50, 25)
    const z = zoomAt(v, anchor[0], anchor[1], 2)
    const after = toScreen(z, 50, 25)
    expect(after[0]).toBeCloseTo(anchor[0])
    expect(after[1]).toBeCloseTo(anchor[1])
  })
  it('pan translates screen coordinates', () => {
    const v = fitView(drawing, 440, 300)
    const p = panBy(v, 10, -5)
    const [x0, y0] = toScreen(v, 0, 0)
    const [x1, y1] = toScreen(p, 0, 0)
    expect([x1 - x0, y1 - y0]).toEqual([10, -5])
  })
})
