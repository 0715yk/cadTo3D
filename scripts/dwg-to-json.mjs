// Build-time converter: DWG -> compact 2D JSON for the browser drawing viewer.
// Usage: node scripts/dwg-to-json.mjs [input.dwg] [output.json]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Dwg_File_Type, LibreDwg } from '@mlightcad/libredwg-web'

const here = dirname(fileURLToPath(import.meta.url))
const input = resolve(process.argv[2] ?? resolve(here, '../LFT-630-00-00.DWG'))
const output = resolve(process.argv[3] ?? resolve(here, '../public/drawings/LFT-630-00-00.json'))

const libredwg = await LibreDwg.create(resolve(here, '../node_modules/@mlightcad/libredwg-web/wasm/'))
const buf = readFileSync(input)
const dwg = libredwg.dwg_read_data(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), Dwg_File_Type.DWG)
const db = libredwg.convert(dwg)

const r = (n) => Math.round(n * 100) / 100
const blocks = new Map((db.tables?.BLOCK_RECORD?.entries ?? []).map((b) => [b.name, b]))
const items = []

const bspline = (deg, knots, cps, n = 24) => {
  const pts = []
  const t0 = knots[deg]
  const t1 = knots[knots.length - 1 - deg]
  for (let i = 0; i <= n; i++) {
    const t = t0 + (t1 - t0) * (i / n)
    let k = deg
    while (k < knots.length - deg - 2 && t >= knots[k + 1]) k++
    const d = []
    for (let j = 0; j <= deg; j++) d.push({ x: cps[j + k - deg].x, y: cps[j + k - deg].y })
    for (let rr = 1; rr <= deg; rr++)
      for (let j = deg; j >= rr; j--) {
        const den = knots[j + 1 + k - rr] - knots[j + k - deg]
        const a = den === 0 ? 0 : (t - knots[j + k - deg]) / den
        d[j] = { x: (1 - a) * d[j - 1].x + a * d[j].x, y: (1 - a) * d[j - 1].y + a * d[j].y }
      }
    pts.push(d[deg])
  }
  return pts
}

const flags = (e) => ({
  ...(e.lineType === 'HIDDEN' ? { h: 1 } : {}),
  ...(e.layer === 'D' || e.type === 'DIMENSION' ? { d: 1 } : {}),
})

const emit = (e, dx = 0, dy = 0, inDim = false) => {
  const f = inDim ? { ...flags(e), d: 1 } : flags(e)
  switch (e.type) {
    case 'LINE':
      items.push({ t: 'l', a: [r(e.startPoint.x + dx), r(e.startPoint.y + dy)], b: [r(e.endPoint.x + dx), r(e.endPoint.y + dy)], ...f })
      break
    case 'CIRCLE':
      items.push({ t: 'c', c: [r(e.center.x + dx), r(e.center.y + dy)], r: r(e.radius), ...f })
      break
    case 'ARC':
      items.push({ t: 'a', c: [r(e.center.x + dx), r(e.center.y + dy)], r: r(e.radius), s: r(e.startAngle), e: r(e.endAngle), ...f })
      break
    case 'LWPOLYLINE':
    case 'POLYLINE2D': {
      const v = e.vertices ?? []
      if (v.length > 1) items.push({ t: 'p', pts: v.flatMap((q) => [r(q.x + dx), r(q.y + dy)]), ...f })
      break
    }
    case 'SPLINE': {
      const pts = e.controlPoints?.length ? bspline(e.degree, e.knots, e.controlPoints) : (e.fitPoints ?? [])
      if (pts.length > 1) items.push({ t: 'p', pts: pts.flatMap((q) => [r(q.x + dx), r(q.y + dy)]), ...f })
      break
    }
    case 'ELLIPSE': {
      const a = Math.hypot(e.majorAxisEndPoint.x, e.majorAxisEndPoint.y)
      const b = a * e.axisRatio
      const rot = Math.atan2(e.majorAxisEndPoint.y, e.majorAxisEndPoint.x)
      let s0 = e.startAngle
      let s1 = e.endAngle
      if (s1 <= s0) s1 += Math.PI * 2
      const pts = []
      for (let i = 0; i <= 32; i++) {
        const t = s0 + (s1 - s0) * (i / 32)
        const px = a * Math.cos(t)
        const py = b * Math.sin(t)
        pts.push(r(e.center.x + dx + px * Math.cos(rot) - py * Math.sin(rot)), r(e.center.y + dy + px * Math.sin(rot) + py * Math.cos(rot)))
      }
      items.push({ t: 'p', pts, ...f })
      break
    }
    case 'MTEXT':
    case 'TEXT': {
      const p = e.insertionPoint ?? e.startPoint
      const text = String(e.text ?? '')
        .replace(/\\A\d;/g, '')
        .replace(/\\P/g, ' ')
        .replace(/%%c/gi, 'Ø')
        .replace(/\{\\[^;]*;|\}/g, '')
      if (p && text.trim()) items.push({ t: 't', p: [r(p.x + dx), r(p.y + dy)], s: text, h: r(e.height || 12), ...f })
      break
    }
    case 'INSERT': {
      const b = blocks.get(e.name)
      for (const c of b?.entities ?? []) emit(c, dx + e.insertionPoint.x, dy + e.insertionPoint.y, inDim)
      break
    }
    case 'DIMENSION': {
      const b = blocks.get(e.name)
      for (const c of b?.entities ?? []) emit(c, dx, dy, true)
      break
    }
    case 'SOLID': {
      const c = [e.corner1, e.corner2, e.corner4 ?? e.corner3, e.corner3].filter(Boolean)
      if (c.length >= 3) items.push({ t: 'f', pts: c.flatMap((q) => [r(q.x + dx), r(q.y + dy)]), ...f })
      break
    }
  }
}

for (const e of db.entities) emit(e)

let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
const see = (x, y) => {
  if (x < minX) minX = x
  if (x > maxX) maxX = x
  if (y < minY) minY = y
  if (y > maxY) maxY = y
}
for (const it of items) {
  if (it.t === 'l') { see(...it.a); see(...it.b) }
  else if (it.t === 'c' || it.t === 'a') { see(it.c[0] - it.r, it.c[1] - it.r); see(it.c[0] + it.r, it.c[1] + it.r) }
  else if (it.t === 'p' || it.t === 'f') for (let i = 0; i < it.pts.length; i += 2) see(it.pts[i], it.pts[i + 1])
  else if (it.t === 't') see(...it.p)
}

const meta = {
  source: input.split(/[\\/]/).pop(),
  version: db.header?.ACADVER ?? null,
  layers: (db.tables?.LAYER?.entries ?? []).map((l) => l.name),
  entityCount: db.entities.length,
}
mkdirSync(dirname(output), { recursive: true })
writeFileSync(output, JSON.stringify({ meta, extents: { minX: r(minX), minY: r(minY), maxX: r(maxX), maxY: r(maxY) }, items }))
libredwg.dwg_free(dwg)
console.log(`wrote ${output}: ${items.length} items, extents ${r(minX)},${r(minY)} – ${r(maxX)},${r(maxY)}`)
