import type { AssemblySpec, PartSpec, Shape, Vec3 } from './types'
import type { LifterParams } from './params'
import { box, boxCentered, boundsOf, cylX, cylY, cylZ, mergeBounds, torusArc } from './shapes'

export const COLORS = {
  frame: '#1f5fa8',
  frameDark: '#163f70',
  carriage: '#2f3b4c',
  steel: '#b4b9bf',
  steelDark: '#7b8188',
  motor: '#3a3f47',
  motorFin: '#9aa3ad',
  reelFlange: '#d9dde1',
  reelCore: '#9aa0a6',
  rubber: '#1c1c1c',
  panel: '#e8eaed',
  panelFace: '#2b2f36',
  chain: '#4a4f57',
} as const

const part = (
  id: string,
  name: string,
  group: PartSpec['group'],
  color: string,
  shapes: readonly Shape[],
  extra: Partial<Pick<PartSpec, 'description' | 'spin' | 'metalness' | 'roughness'>> = {},
): PartSpec => ({ id, name, group, color, shapes, ...extra })

// ---------- base ----------

const baseParts = (p: LifterParams): readonly PartSpec[] => {
  const [x0, x1] = [-255, 475]
  const halfW = p.baseBeamWidth / 2
  const halfC = p.crossBeamWidth / 2
  const railW = 60
  return [
    part('base-beam', '베이스 메인 빔', 'base', COLORS.frame, [
      box([x0, 16, -halfW], [x1, 16 + p.baseBeamHeight, halfW]),
    ], { description: `${x1 - x0} × ${p.baseBeamWidth} × ${p.baseBeamHeight} 각관 메인 프레임` }),
    part('base-rails', '베이스 사이드 레일', 'base', COLORS.frame, [
      box([x0, 16, halfC - railW], [x1, 66, halfC]),
      box([x0, 16, -halfC], [x1, 66, -halfC + railW]),
      box([x0, 16, -halfC], [x0 + 80, 66, halfC]),
      box([x1 - 80, 16, -halfC], [x1, 66, halfC]),
    ]),
    part('base-endplates', '엔드 플레이트', 'base', COLORS.frameDark, [
      box([x0 - 12, 16, -halfC], [x0, 136, halfC]),
      box([x1, 16, -halfC], [x1 + 12, 136, halfC]),
    ]),
    part('base-pedestal', '마스트 받침대', 'base', COLORS.frame, [
      box([-110, 16 + p.baseBeamHeight, -halfW], [110, 233, halfW]),
    ]),
  ]
}

const casterParts = (p: LifterParams): readonly PartSpec[] => {
  const r = p.wheelDiameter / 2
  const halfC = p.crossBeamWidth / 2
  const wheelZ = p.wheelCenterZ
  const armZ: readonly [number, number] = [halfC, wheelZ - p.wheelWidth / 2]
  return p.wheelCentersX.flatMap((wx, i) =>
    ([1, -1] as const).flatMap((side) => {
      const z = side * wheelZ
      const label = `${i === 0 ? '후' : '전'}${side > 0 ? '우' : '좌'}`
      const armX: readonly [number, number] = i === 0 ? [-380, -267] : [487, 600]
      const suffix = `${i}-${side > 0 ? 'r' : 'l'}`
      const hw = p.wheelWidth / 2
      return [
        part(`caster-wheel-${suffix}`, `캐스터 휠 Ø${p.wheelDiameter} (${label})`, 'base', COLORS.rubber, [
          cylZ(r, z - hw, z + hw, wx, r, 48),
        ], { description: '고무 바퀴, 폭 ' + p.wheelWidth + 'mm' }),
        part(`caster-fork-${suffix}`, `캐스터 브래킷 (${label})`, 'base', COLORS.steelDark, [
          cylZ(r * 0.45, z - hw - 3, z + hw + 3, wx, r, 32),
          box([armX[0], 16, Math.min(side * armZ[0], side * armZ[1])], [armX[1], 136, Math.max(side * armZ[0], side * armZ[1])]),
          cylZ(12, Math.min(side * armZ[1], z + side * 25), Math.max(side * armZ[1], z + side * 25), wx, r, 16),
        ]),
      ]
    }),
  )
}

// ---------- mast ----------

const mastParts = (p: LifterParams): readonly PartSpec[] => {
  const [cx0, cx1] = [-80, 90]
  const dz = p.mastDepthZ / 2
  const colT = 40
  const y0 = 233
  const y1 = p.topHousingBottomY
  return [
    part('mast-columns', '마스트 컬럼', 'mast', COLORS.frame, [
      box([cx0, y0, dz - colT], [cx1, y1, dz]),
      box([cx0, y0, -dz], [cx1, y1, -dz + colT]),
      box([cx0, y0, -dz], [cx0 + 20, y1, dz]),
    ], { description: `높이 ${y1 - y0}mm U-채널 가이드 컬럼` }),
    part('lift-chain', '리프트 체인', 'mast', COLORS.chain, [
      box([-50, y0, -4], [-42, y1, 4]),
      box([-50, y0, 26], [-42, y1, 34]),
    ]),
    part('mast-top-housing', '스프라켓 하우징', 'mast', COLORS.frame, [
      box([-130, p.topHousingBottomY, -p.topHousingHalfZ], [130, p.mastTopY, p.topHousingHalfZ]),
    ]),
    part('mast-top-plate', '탑 플레이트', 'mast', COLORS.frameDark, [
      box([-130, p.mastTopY, -p.topPlateHalfZ], [130, p.mastTopY + p.topPlateThickness, p.topPlateHalfZ]),
    ]),
    part('lever', '잠금 레버', 'mast', COLORS.steelDark, [
      box([-382, 1100, 190], [-60, 1130, 215]),
      torusArc([-382, 1115, 202.5], 17, 6, 'xy', 0, Math.PI * 2),
    ]),
  ]
}

// ---------- lift drive (geared motor on top) ----------

const liftDriveParts = (p: LifterParams): readonly PartSpec[] => {
  const [mx, mz] = p.liftMotorCenter
  const top = p.mastTopY + p.topPlateThickness
  const [my0, my1] = p.liftMotorY
  const r = p.liftMotorDiameter / 2
  return [
    part('lift-gearbox', '리프트 감속기 (1/20)', 'liftDrive', COLORS.motor, [
      box([-130, top, -215], [130, top + 101, 40]),
      cylY(45, top + 101, my0, mx, mz, 32),
    ]),
    part('lift-motor', 'AC 기어드 모터 1.5kW × 1/20', 'liftDrive', COLORS.motor, [
      cylY(r * 0.9, my0, my1, mx, mz, 40),
      cylY(r, my0 + 8, my1 - 8, mx, mz, 20),
      cylY(r * 0.9, my1, my1 + 81, mx, mz, 40),
      boxCentered([mx + 95, my0 + 90, mz], [60, 80, 90]),
    ], { description: '삼양 V153-015 · 리프트 구동용 수직 기어드 모터' }),
  ]
}

// ---------- carriage (cross head) ----------

const carriageParts = (p: LifterParams): readonly PartSpec[] => {
  const hx = p.carriageHalfX
  const hz = p.mastDepthZ / 2 + 8
  const sy = p.spindleY
  return [
    part('carriage-body', '크로스 헤드 (캐리지)', 'carriage', COLORS.carriage, [
      box([-hx, p.carriageBottomY, -hz], [hx, p.carriageTopY, hz]),
    ], { description: `마스트를 감싸는 슬리브형 캐리지, 행정 ${p.liftStroke[1] - p.liftStroke[0]}mm` }),
    part('bearing-housing-l', '베어링 하우징 (모터측)', 'carriage', COLORS.steelDark, [
      box([-180, sy - 105, -105], [-hx, sy + 105, 105]),
    ]),
    part('bearing-housing-r', '베어링 하우징 (릴측)', 'carriage', COLORS.steelDark, [
      box([hx, sy - 100, -100], [235, sy + 100, 100]),
      cylX(70, 235, 262, sy, 0, 32),
    ]),
    part('spindle', `스핀들 샤프트 Ø${p.spindleDiameter}`, 'carriage', COLORS.steel, [
      cylX(p.spindleDiameter / 2, -180, 850, sy, 0, 32),
    ], { metalness: 0.9, roughness: 0.25, spin: { axis: 'x', pivot: [0, sy, 0] } }),
  ]
}

// ---------- spindle drive ----------

const spindleDriveParts = (p: LifterParams): readonly PartSpec[] => {
  const sy = p.spindleY
  const [x0, x1] = p.spindleMotorX
  const r = p.spindleMotorDiameter / 2
  return [
    part('spindle-motor', '스핀들 모터 1.5kW × 2P', 'spindleDrive', COLORS.motor, [
      cylX(r * 0.92, x0, x1, sy, 0, 40),
      cylX(r, x0 + 20, x1 - 20, sy, 0, 20),
      cylX(r * 0.8, x0 - 30, x0, sy, 0, 32),
      box([-305, sy + 70, -40], [-210, sy + 129, 40]),
    ], { description: '릴 회전 구동용 AC 모터' }),
    part('spindle-motor-adapter', '모터 어댑터 플랜지', 'spindleDrive', COLORS.steelDark, [
      cylX(55, x1, -180, sy, 0, 32),
    ]),
  ]
}

// ---------- reel (the lifted load) ----------

const reelParts = (p: LifterParams): readonly PartSpec[] => {
  const sy = p.spindleY
  const spin = { axis: 'x' as const, pivot: [0, sy, 0] as Vec3 }
  const [c0, c1] = p.reelCoreX
  const ft = p.reelFlangeThickness
  const [r0, r1] = p.reelRimX
  const rimTube = (r1 - r0) / 2
  return [
    part('reel-hub', `허브 Ø${p.reelHubDiameter}`, 'reel', COLORS.steelDark, [
      cylX(p.reelHubDiameter / 2, 300, c0 - ft, sy, 0, 48),
    ], { spin }),
    part('reel-flange-a', `릴 플랜지 Ø${p.reelFlangeDiameter} (내측)`, 'reel', COLORS.reelFlange, [
      cylX(p.reelFlangeDiameter / 2, c0 - ft, c0, sy, 0, 96),
    ], { spin }),
    part('reel-core', `릴 코어 Ø${p.reelCoreDiameter}`, 'reel', COLORS.reelCore, [
      cylX(p.reelCoreDiameter / 2, c0, c1, sy, 0, 64),
    ], { spin, description: `폭 ${c1 - c0}mm 권취 코어` }),
    part('reel-flange-b', `릴 플랜지 Ø${p.reelFlangeDiameter} (외측)`, 'reel', COLORS.reelFlange, [
      cylX(p.reelFlangeDiameter / 2, c1, c1 + ft, sy, 0, 96),
    ], { spin }),
    part('reel-dish', `엔드 디스크 Ø${p.reelRimDiameter}`, 'reel', COLORS.reelFlange, [
      cylX(p.reelDishDiameter / 2, c1 + ft + 1, r0, sy, 0, 96),
      cylX(p.reelRimDiameter / 2 - rimTube, r0, r1, sy, 0, 96),
      torusArc([r0 + rimTube, sy, 0], p.reelRimDiameter / 2 - rimTube, rimTube, 'yz', 0, Math.PI * 2),
    ], { spin, description: `Ø${p.reelRimDiameter} 라운드 림 — 610 콘 리프터의 적재 기준` }),
    part('reel-nut', '고정 너트', 'reel', COLORS.steel, [
      cylX(32, 850, 872, sy, 0, 6),
    ], { spin, metalness: 0.9, roughness: 0.3 }),
  ]
}

// ---------- handles / panel ----------

const pushHandleParts = (p: LifterParams): readonly PartSpec[] => {
  const r = p.handleTubeDiameter / 2
  const z = p.pushHandleZ
  const top = p.mastTopY + p.topPlateThickness
  const R = p.pushHandleBendRadius
  const yTop = p.pushHandleBendY + R
  return [
    part('push-handle', `푸시 핸들 Ø${p.handleTubeDiameter}`, 'pushHandle', COLORS.frame, [
      cylY(r, top, p.pushHandleBendY, 0, z, 24),
      torusArc([R, p.pushHandleBendY, z], R, r, 'xy', Math.PI / 2, Math.PI / 2),
      cylX(r, R, p.pushHandleEndX, yTop, z, 24),
    ], { description: `전고 ${yTop}mm` }),
    part('push-handle-grip', '핸들 그립', 'pushHandle', COLORS.rubber, [
      cylX(r + 4, p.pushHandleEndX - 150, p.pushHandleEndX + 2, yTop, z, 24),
    ]),
  ]
}

const footBarParts = (p: LifterParams): readonly PartSpec[] => {
  const r = p.handleTubeDiameter / 2
  return [
    part('foot-bar', `풋 가드 바 Ø${p.handleTubeDiameter}`, 'footBar', COLORS.frame, [
      cylX(r, p.footBarEndX, -80, p.footBarY, 0, 24),
      cylZ(r, -p.footBarHalfZ, p.footBarHalfZ, p.footBarEndX, p.footBarY, 24),
    ], { description: '후방 범퍼 겸 발 보호 바' }),
  ]
}

const panelParts = (p: LifterParams): readonly PartSpec[] => {
  const { x, y, z } = p.panelBox
  return [
    part('control-panel', '조작 판넬', 'panel', COLORS.panel, [
      box([x[0], y[0], z[0]], [x[1], y[1], z[1]]),
      box([x[0] + 8, y[0] + 8, z[1]], [x[1] - 8, y[1] - 8, z[1] + 3]),
      box([-20, 1240, p.topHousingHalfZ], [20, 1270, z[0]]),
    ], { description: '상승/하강 · 릴 회전 조작 버튼' }),
    part('control-panel-face', '판넬 버튼면', 'panel', COLORS.panelFace, [
      box([x[0] + 10, y[0] + 10, z[1] + 3], [x[1] - 10, y[1] - 10, z[1] + 4]),
    ]),
  ]
}

export const buildLifter = (p: LifterParams): AssemblySpec => {
  const parts = [
    ...baseParts(p),
    ...casterParts(p),
    ...mastParts(p),
    ...liftDriveParts(p),
    ...carriageParts(p),
    ...spindleDriveParts(p),
    ...reelParts(p),
    ...pushHandleParts(p),
    ...footBarParts(p),
    ...panelParts(p),
  ]
  const bounds = parts.map((q) => boundsOf(q.shapes)).reduce(mergeBounds)
  return { parts, bounds }
}
