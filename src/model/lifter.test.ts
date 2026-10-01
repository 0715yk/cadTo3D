import { describe, expect, it } from 'vitest'
import { buildLifter } from './lifter'
import { LFT630 } from './params'
import { boundsOf, shapeBounds, cylX, box, torusArc } from './shapes'
import { explodeOffset, groupTranslation, liftOffset, liftRestT, reelAngle, LIFTED_GROUPS } from './kinematics'
import { buildBom, findPart } from './bom'
import { demoLiftAt } from '../ui/demo'
import { ASTRA_DIMENSIONS, buildAstraLifter } from './astra'

const spec = buildLifter(LFT630)

describe('Astra reconstruction contracts (not CAD accuracy)', () => {
  const astra = buildAstraLifter()

  it('is deterministic and has distinct part ids and finite positive geometry', () => {
    expect(buildAstraLifter()).toEqual(astra)
    expect(new Set(astra.parts.map((part) => part.id)).size).toBe(astra.parts.length)
    for (const part of astra.parts) {
      expect(part.id.startsWith('astra-')).toBe(true)
      for (const shape of part.shapes) {
        const bounds = shapeBounds(shape)
        bounds.min.forEach((minimum, axis) => {
          expect(Number.isFinite(minimum)).toBe(true)
          expect(Number.isFinite(bounds.max[axis])).toBe(true)
          expect(bounds.max[axis]).toBeGreaterThan(minimum)
        })
      }
    }
  })

  it('preserves labeled wheel diameter, wheelbase and outer width', () => {
    const wheels = astra.parts.filter((part) => /^astra-wheel-\d--?1$/.test(part.id))
    expect(wheels).toHaveLength(4)
    const bounds = boundsOf(wheels.flatMap((part) => part.shapes))
    expect(bounds.min[1]).toBe(0)
    expect(bounds.max[1]).toBe(152)
    expect(bounds.max[0] - bounds.min[0]).toBe(1072)
    expect(bounds.max[2] - bounds.min[2]).toBe(875)
  })

  it('preserves labeled reel diameter, width and spindle height', () => {
    const flanges = astra.parts.filter((part) => part.id.startsWith('astra-reel-flange'))
    const bounds = boundsOf(flanges.flatMap((part) => part.shapes))
    expect(bounds.max[0] - bounds.min[0]).toBe(400)
    expect(bounds.max[1] - bounds.min[1]).toBe(610)
    expect((bounds.min[1] + bounds.max[1]) / 2).toBe(527)
    expect(ASTRA_DIMENSIONS.labeled.handleCenterHeight).toBe(2127)
    for (const part of astra.parts.filter((part) => part.group === 'reel')) {
      expect(part.spin).toEqual({ axis: 'x', pivot: [0, 527, 0] })
    }
  })

  it('does not mutate the original assembly', () => {
    buildAstraLifter()
    expect(buildLifter(LFT630)).toEqual(spec)
  })
})

describe('shapes', () => {
  it('cylinder bounds along x', () => {
    const b = shapeBounds(cylX(10, 0, 100, 50, 5))
    expect(b.min).toEqual([0, 40, -5])
    expect(b.max).toEqual([100, 60, 15])
  })
  it('merges bounds across shapes', () => {
    const b = boundsOf([box([0, 0, 0], [1, 1, 1]), torusArc([10, 10, 10], 2, 1, 'xy', 0, Math.PI)])
    expect(b.min).toEqual([0, 0, 0])
    expect(b.max).toEqual([13, 13, 13])
  })
})

describe('lifter model', () => {
  it('has unique part ids', () => {
    const ids = spec.parts.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('stands on the floor and the handle centerline sits at the drawn overall height (2127)', () => {
    expect(spec.bounds.min[1]).toBeCloseTo(0, 0)
    const handle = findPart(spec, 'push-handle')!
    const topTube = handle.shapes.find((s) => s.kind === 'cylinder' && s.axis === 'x')!
    expect(topTube.kind === 'cylinder' && topTube.start[1]).toBeCloseTo(LFT630.overallHeight)
    expect(spec.bounds.max[1]).toBeGreaterThan(LFT630.overallHeight)
    expect(spec.bounds.max[1]).toBeLessThan(LFT630.overallHeight + 40)
  })
  it('matches overall length (wheel outer to outer = 1072)', () => {
    const wheels = spec.parts.filter((p) => p.id.startsWith('caster-wheel'))
    const b = wheels.map((p) => boundsOf(p.shapes)).reduce((a, c) => ({
      min: [Math.min(a.min[0], c.min[0]), 0, 0] as const,
      max: [Math.max(a.max[0], c.max[0]), 0, 0] as const,
    }))
    expect(b.max[0] - b.min[0]).toBeCloseTo(LFT630.baseLength, 0)
  })
  it('matches overall width (875) across casters', () => {
    const wheels = spec.parts.filter((p) => p.id.startsWith('caster-wheel'))
    const zs = wheels.flatMap((p) => {
      const b = boundsOf(p.shapes)
      return [b.min[2], b.max[2]]
    })
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(875, 0)
  })
  it('places reel on the spindle axis', () => {
    const core = findPart(spec, 'reel-core')!
    const b = boundsOf(core.shapes)
    expect((b.min[1] + b.max[1]) / 2).toBeCloseTo(LFT630.spindleY)
    expect(b.max[0] - b.min[0]).toBeCloseTo(LFT630.reelCoreX[1] - LFT630.reelCoreX[0])
  })
  it('all reel parts spin around the spindle', () => {
    for (const p of spec.parts.filter((q) => q.group === 'reel')) {
      expect(p.spin?.axis).toBe('x')
      expect(p.spin?.pivot[1]).toBe(LFT630.spindleY)
    }
  })
  it('groups every part in the BOM exactly once', () => {
    const bom = buildBom(spec)
    const total = bom.reduce((n, r) => n + r.parts.length, 0)
    expect(total).toBe(spec.parts.length)
  })
})

describe('kinematics', () => {
  it('explode offset scales linearly and clamps', () => {
    expect(explodeOffset('reel', 0)).toEqual([0, 0, 0])
    expect(explodeOffset('reel', 0.5)[0]).toBeCloseTo(400)
    expect(explodeOffset('reel', 2)[0]).toBeCloseTo(800)
    expect(explodeOffset('mast', 1)).toEqual([0, 0, 0])
  })
  it('lift rest position maps to zero offset', () => {
    expect(liftOffset(liftRestT(LFT630), LFT630)).toBeCloseTo(0)
    expect(liftOffset(0, LFT630)).toBe(LFT630.liftStroke[0])
    expect(liftOffset(1, LFT630)).toBe(LFT630.liftStroke[1])
  })
  it('only carriage-mounted groups move with the lift', () => {
    const state = { explode: 0, lift: 1, reelAngle: 0 }
    expect(groupTranslation('reel', state, LFT630)[1]).toBeCloseTo(LFT630.liftStroke[1])
    expect(groupTranslation('mast', state, LFT630)[1]).toBe(0)
    expect(LIFTED_GROUPS).toContain('spindleDrive')
  })
  it('reel angle: 60 rpm = one turn per second', () => {
    expect(reelAngle(1, 60)).toBeCloseTo(Math.PI * 2)
  })
  it('demo cycle stays in [0,1] and starts at rest', () => {
    expect(demoLiftAt(0)).toBe(0)
    for (let t = 0; t < 10; t += 0.25) {
      const v = demoLiftAt(t)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
    expect(demoLiftAt(5.2)).toBe(1)
  })
})
