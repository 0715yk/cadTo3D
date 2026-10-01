import { fitView, panBy, toScreen, zoomAt, type Drawing2D, type DrawingItem, type View2D } from './drawing'

const strokeFor = (it: DrawingItem): string => (it.d ? '#d6453d' : it.h ? '#9aa0a6' : '#1b1f24')

const drawItem = (ctx: CanvasRenderingContext2D, v: View2D, it: DrawingItem): void => {
  ctx.strokeStyle = strokeFor(it)
  ctx.setLineDash(it.h ? [6, 4] : [])
  switch (it.t) {
    case 'l': {
      const [ax, ay] = toScreen(v, it.a[0], it.a[1])
      const [bx, by] = toScreen(v, it.b[0], it.b[1])
      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.lineTo(bx, by)
      ctx.stroke()
      break
    }
    case 'c': {
      const [cx, cy] = toScreen(v, it.c[0], it.c[1])
      ctx.beginPath()
      ctx.arc(cx, cy, Math.abs(it.r) * v.scale, 0, Math.PI * 2)
      ctx.stroke()
      break
    }
    case 'a': {
      const [cx, cy] = toScreen(v, it.c[0], it.c[1])
      ctx.beginPath()
      // canvas Y is flipped, so CCW in drawing space = CW on screen
      ctx.arc(cx, cy, Math.abs(it.r) * v.scale, -it.s, -it.e, true)
      ctx.stroke()
      break
    }
    case 'p':
    case 'f': {
      ctx.beginPath()
      for (let i = 0; i < it.pts.length; i += 2) {
        const [x, y] = toScreen(v, it.pts[i], it.pts[i + 1])
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      if (it.t === 'f') {
        ctx.closePath()
        ctx.fillStyle = strokeFor(it)
        ctx.fill()
      } else ctx.stroke()
      break
    }
    case 't': {
      const px = it.h * v.scale
      if (px < 3) return
      const [x, y] = toScreen(v, it.p[0], it.p[1])
      ctx.fillStyle = it.d ? '#1e63c9' : '#0b5fb0'
      ctx.font = `${px}px "Segoe UI", sans-serif`
      ctx.fillText(it.s, x, y)
      break
    }
  }
}

export const renderDrawing = (ctx: CanvasRenderingContext2D, d: Drawing2D, v: View2D, width: number, height: number): void => {
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.lineWidth = 1
  ctx.lineCap = 'round'
  for (const it of d.items) drawItem(ctx, v, it)
}

export interface Drawing2DViewer {
  fit(): void
  dispose(): void
}

export const createDrawingViewer = (canvas: HTMLCanvasElement, drawing: Drawing2D): Drawing2DViewer => {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D context unavailable')
  let view: View2D = { scale: 1, tx: 0, ty: 0 }
  let dpr = 1
  let dirty = true

  const cssSize = () => ({ w: canvas.clientWidth, h: canvas.clientHeight })

  const fit = () => {
    const { w, h } = cssSize()
    if (w === 0 || h === 0) return
    view = fitView(drawing, w, h)
    dirty = true
  }

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio, 2)
    const { w, h } = cssSize()
    if (w === 0 || h === 0) return
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    fit()
  }

  const draw = () => {
    if (!dirty) return
    const { w, h } = cssSize()
    if (w === 0 || h === 0) return
    dirty = false
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    renderDrawing(ctx, drawing, view, w, h)
  }

  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    const rect = canvas.getBoundingClientRect()
    view = zoomAt(view, e.clientX - rect.left, e.clientY - rect.top, e.deltaY < 0 ? 1.15 : 1 / 1.15)
    dirty = true
  }

  // Active touch/mouse pointers for pan (1 pointer) and pinch-zoom (2 pointers).
  const pointers = new Map<number, { x: number; y: number }>()
  let pinchDist = 0
  let pinchMid: { x: number; y: number } | null = null
  const local = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const onDown = (e: PointerEvent) => {
    try {
      canvas.setPointerCapture(e.pointerId)
    } catch {
      // ignore: pointer may already be released
    }
    pointers.set(e.pointerId, local(e))
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()]
      pinchDist = Math.hypot(a.x - b.x, a.y - b.y)
      pinchMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    }
  }
  const onMove = (e: PointerEvent) => {
    const prev = pointers.get(e.pointerId)
    if (!prev) return
    const cur = local(e)
    pointers.set(e.pointerId, cur)
    if (pointers.size >= 2) {
      const [a, b] = [...pointers.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      if (pinchDist > 0) {
        if (dist > 0) view = zoomAt(view, mid.x, mid.y, dist / pinchDist)
        if (pinchMid) view = panBy(view, mid.x - pinchMid.x, mid.y - pinchMid.y)
        dirty = true
      }
      pinchDist = dist
      pinchMid = mid
    } else {
      view = panBy(view, cur.x - prev.x, cur.y - prev.y)
      dirty = true
    }
  }
  const onUp = (e: PointerEvent) => {
    pointers.delete(e.pointerId)
    if (pointers.size < 2) {
      pinchDist = 0
      pinchMid = null
    }
  }
  const onDbl = () => fit()

  canvas.addEventListener('wheel', onWheel, { passive: false })
  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('pointerup', onUp)
  canvas.addEventListener('pointercancel', onUp)
  canvas.addEventListener('dblclick', onDbl)
  const ro = new ResizeObserver(resize)
  ro.observe(canvas)
  resize()

  let disposed = false
  const loop = () => {
    if (disposed) return
    draw()
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)

  return {
    fit,
    dispose: () => {
      disposed = true
      ro.disconnect()
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      canvas.removeEventListener('dblclick', onDbl)
    },
  }
}
