import { LFT630 } from './model/params'
import { buildAstraLifter } from './model/astra'
import { findPart } from './model/bom'
import { liftRestT, reelAngle, type PoseState } from './model/kinematics'
import type { GroupId } from './model/types'
import { createViewer, type ViewPreset } from './three/viewer'
import { createDrawingViewer, type Drawing2DViewer } from './dwg/drawingViewer'
import type { Drawing2D } from './dwg/drawing'
import { markSelectedInBom, renderBom, renderPartInfo, renderSpecs } from './ui/panel'
import { demoLiftAt } from './ui/demo'

const $ = <T extends HTMLElement>(sel: string): T => {
  const el = document.querySelector<T>(sel)
  if (!el) throw new Error(`missing element ${sel}`)
  return el
}

const params = LFT630
const spec = buildAstraLifter()
$<HTMLElement>('#modelStatus').textContent = 'Astra 재구성 · 형상/재질/동작 추정 · 실물 검증 전'

const canvas3d = $<HTMLCanvasElement>('#canvas3d')
const canvas2d = $<HTMLCanvasElement>('#canvas2d')
const viewer = createViewer(canvas3d, spec, params)

// ---- pose state (single source of truth) ----
let pose: PoseState = { explode: 0, lift: liftRestT(params), reelAngle: 0 }
let reelSpinning = false
let demoStartedAt: number | null = null
let selectedPart: string | null = null
const hiddenGroups = new Set<GroupId>()

const liftInput = $<HTMLInputElement>('#lift')
const liftOut = $<HTMLOutputElement>('#liftOut')
const explodeInput = $<HTMLInputElement>('#explode')
const explodeOut = $<HTMLOutputElement>('#explodeOut')
const demoBtn = $<HTMLButtonElement>('#demoBtn')
const bomEl = $<HTMLElement>('#bom')
const partInfoEl = $<HTMLElement>('#partInfo')

const setPose = (next: Partial<PoseState>) => {
  pose = { ...pose, ...next }
  viewer.setPose(pose)
  liftInput.value = String(Math.round(pose.lift * 1000))
  const [lo, hi] = params.liftStroke
  liftOut.textContent = `${Math.round(lo + (hi - lo) * pose.lift) >= 0 ? '+' : ''}${Math.round(lo + (hi - lo) * pose.lift)} mm`
  explodeInput.value = String(Math.round(pose.explode * 1000))
  explodeOut.textContent = `${Math.round(pose.explode * 100)}%`
}

const select = (partId: string | null) => {
  selectedPart = partId
  viewer.setSelected(partId)
  markSelectedInBom(bomEl, partId)
  renderPartInfo(partInfoEl, partId ? (findPart(spec, partId) ?? null) : null)
}

// ---- controls ----
liftInput.addEventListener('input', () => {
  stopDemo()
  setPose({ lift: Number(liftInput.value) / 1000 })
})
explodeInput.addEventListener('input', () => setPose({ explode: Number(explodeInput.value) / 1000 }))
$<HTMLInputElement>('#reelSpin').addEventListener('change', (e) => {
  reelSpinning = (e.target as HTMLInputElement).checked
})
$<HTMLInputElement>('#autoRotate').addEventListener('change', (e) => viewer.setAutoRotate((e.target as HTMLInputElement).checked))

const viewButtons = $<HTMLElement>('#viewButtons')
viewButtons.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-view]')
  if (!btn) return
  viewer.setView(btn.dataset.view as ViewPreset)
  for (const b of viewButtons.querySelectorAll('button')) b.classList.toggle('is-active', b === btn)
})

const startDemo = () => {
  demoStartedAt = performance.now()
  demoBtn.textContent = '자동 시연 정지'
  demoBtn.classList.add('is-running')
  ;($<HTMLInputElement>('#reelSpin').checked = true), (reelSpinning = true)
}
const stopDemo = () => {
  if (demoStartedAt === null) return
  demoStartedAt = null
  demoBtn.textContent = '자동 시연 시작'
  demoBtn.classList.remove('is-running')
}
demoBtn.addEventListener('click', () => (demoStartedAt === null ? startDemo() : stopDemo()))

renderBom(bomEl, spec, {
  onSelect: (id) => select(selectedPart === id ? null : id),
  onGroupToggle: (group, visible) => {
    if (visible) hiddenGroups.delete(group)
    else hiddenGroups.add(group)
    const visibleSet = new Set<GroupId>(spec.parts.map((p) => p.group).filter((g) => !hiddenGroups.has(g)))
    viewer.setVisibleGroups(visibleSet)
  },
})
renderSpecs($<HTMLTableElement>('#specs'), [
  ['핸들 중심선 높이', '2,127 mm'],
  ['바퀴 외측 길이 / 폭', '1,072 / 875 mm'],
  ['스핀들 축 높이', '527 mm'],
  ['릴 플랜지 / 외측 디스크', 'Ø610 / Ø710 mm'],
  ['플랜지 바깥면 간격', '400 mm'],
  ['상부 플레이트 폭', '525 mm'],
  ['동작 범위 / 속도', '시연용 가정값'],
])
viewer.onPick(select)
setPose({})

// ---- animation (reel spin / demo) ----
const REEL_RPM = 20
let lastT = performance.now()
const tick = (now: number) => {
  const dt = (now - lastT) / 1000
  lastT = now
  const next: { -readonly [K in keyof PoseState]?: PoseState[K] } = {}
  if (reelSpinning) next.reelAngle = pose.reelAngle + reelAngle(dt, REEL_RPM)
  if (demoStartedAt !== null) next.lift = demoLiftAt((now - demoStartedAt) / 1000)
  if (Object.keys(next).length) setPose(next)
  requestAnimationFrame(tick)
}
requestAnimationFrame(tick)

// ---- tabs: 3D / 2D ----
let drawingViewer: Drawing2DViewer | null = null
let drawingPromise: Promise<Drawing2D> | null = null
const hint = $<HTMLElement>('#stageHint')

const loadDrawing = () => {
  drawingPromise ??= fetch(`${import.meta.env.BASE_URL}drawings/LFT-630-00-00.json`).then((r) => {
    if (!r.ok) throw new Error(`도면 데이터 로드 실패 (${r.status})`)
    return r.json() as Promise<Drawing2D>
  })
  return drawingPromise
}

const showTab = async (tab: '3d' | '2d') => {
  for (const b of document.querySelectorAll<HTMLButtonElement>('.tab')) b.classList.toggle('is-active', b.dataset.tab === tab)
  canvas3d.classList.toggle('is-hidden', tab !== '3d')
  canvas2d.classList.toggle('is-hidden', tab !== '2d')
  if (tab === '2d') {
    hint.textContent = '휠: 줌 · 드래그: 이동 · 더블클릭: 전체 보기 · 원본 DWG(AutoCAD 2000) 그대로 렌더'
    if (!drawingViewer) {
      try {
        const d = await loadDrawing()
        drawingViewer = createDrawingViewer(canvas2d, d)
      } catch (err) {
        hint.textContent = (err as Error).message + ' — `npm run dwg:json` 실행 필요'
      }
    } else drawingViewer.fit()
  } else hint.textContent = '드래그: 회전 · 휠: 줌 · 우클릭 드래그: 이동 · 부품 클릭: 정보'
}
document.querySelector('.tabs')?.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.tab')
  if (btn) void showTab(btn.dataset.tab as '3d' | '2d')
})
