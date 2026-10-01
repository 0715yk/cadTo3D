import type { AssemblySpec, GroupId, PartSpec, Shape, Vec3 } from './types'
import { boundsOf, box, boxCentered, cylX, cylY, cylZ, mergeBounds, torusArc } from './shapes'

export const ASTRA_DIMENSIONS = {
  labeled: {
    spindleHeight: 527,
    wheelDiameter: 152,
    wheelbase: 920,
    wheelOuterWidth: 875,
    reelFlangeDiameter: 610,
    reelEndDiameter: 710,
    reelWidth: 400,
    guideSpacing: 415,
    upperWidth: 525,
    handleCenterHeight: 2127,
  },
  estimated: {
    wheelWidth: 40,
    mastX: 0,
    rearWheelX: -350,
    reelStartX: 358,
    flangeThickness: 12,
    coreRadius: 134,
    screwRadius: 16,
    handleRadius: 24.3,
    handleBendRadius: 150,
  },
} as const

const paint = '#26756b'
const darkPaint = '#255049'
const steel = '#bac0c4'
const motor = '#454c50'
const rubber = '#25272a'
const yellow = '#d1a338'
const estimate = '도면 기반 형상 추정. 세부 치수와 재질은 미검증.'

const component = (id: string, name: string, group: GroupId, color: string, shapes: readonly Shape[], description = estimate): PartSpec => ({
  id: `astra-${id}`, name, group, color, shapes, description,
  metalness: color === steel ? 0.7 : 0.25,
  roughness: color === steel ? 0.35 : 0.6,
})

const boltRing = (radius: number, count: number, startX: number, centerY: number, centerZ: number): Shape[] =>
  Array.from({ length: count }, (_, index) => {
    const angle = index * Math.PI * 2 / count
    return cylX(7, startX, startX + 8, centerY + radius * Math.cos(angle), centerZ + radius * Math.sin(angle), 6)
  })

const buildBase = (): PartSpec[] => {
  const { labeled, estimated } = ASTRA_DIMENSIONS
  const radius = labeled.wheelDiameter / 2
  const halfTrack = (labeled.wheelOuterWidth - estimated.wheelWidth) / 2
  const wheels = [estimated.rearWheelX, estimated.rearWheelX + labeled.wheelbase].flatMap((wheelX, index) =>
    [-1, 1].flatMap((side) => {
      const wheelZ = side * halfTrack
      const wheelHalfWidth = estimated.wheelWidth / 2
      const prefix = `wheel-${index}-${side}`
      return [
        component(prefix, `캐스터 ${index * 2 + (side > 0 ? 2 : 1)} · Ø152`, 'base', rubber, [
          cylZ(radius, wheelZ - wheelHalfWidth, wheelZ + wheelHalfWidth, wheelX, radius, 48),
        ], '도면 치수 Ø152, 축간 920, 바퀴 외측 폭 875. 휠 폭은 추정.'),
        component(`${prefix}-fork`, '캐스터 포크 / 허브', 'base', steel, [
          cylZ(31, wheelZ - 21, wheelZ + 21, wheelX, radius, 32),
          ...[-1, 1].map((face) => boxCentered([wheelX, 104, wheelZ + face * 24], [60, 64, 6])),
          boxCentered([wheelX, 136, wheelZ], [100, 8, 58]),
          cylY(19, 140, 158, wheelX, wheelZ),
        ]),
      ]
    }),
  )
  return [
    component('chassis', '용접 베이스 / 아웃리거', 'base', paint, [
      ...[-1, 1].map((side) => box([-380, 16, side * 300 - 35], [600, 116, side * 300 + 35])),
      box([-267, 16, -335], [-217, 116, 335]),
      box([425, 16, -335], [475, 116, 335]),
      ...[-350, 570].flatMap((wheelX) => [-1, 1].map((side) =>
        boxCentered([wheelX, 164, side * 363], [100, 12, 167]))),
      box([-120, 116, -238], [120, 138, 238]),
    ]),
    ...wheels,
  ]
}

const buildMast = (): PartSpec[] => {
  const { labeled, estimated } = ASTRA_DIMENSIONS
  return [
    ...[-1, 1].map((side) => {
      const guideZ = side * labeled.guideSpacing / 2
      return component(`guide-${side}`, `가이드 채널 ${side > 0 ? '우' : '좌'}`, 'mast', paint, [
        box([-70, 138, guideZ - 8], [65, 1039, guideZ + 8]),
        box([-70, 138, guideZ - 28], [-58, 1039, guideZ + 28]),
        box([53, 138, guideZ - 28], [65, 1039, guideZ + 28]),
      ])
    }),
    component('mast-foot', '가이드 하부 연결대', 'mast', darkPaint, [
      box([-70, 138, -235], [65, 208, 235]),
    ]),
    component('upper-case', '상부 전달부 하우징', 'mast', paint, [
      box([-100, 1039, -237.5], [100, 1114, 237.5]),
      box([-65, 1137, -175], [65, 1242, 175]),
      ...[-1, 1].map((side) => box([-100, 1114, side * 220 - 10], [100, 1261, side * 220 + 10])),
      box([-130, 1261, -labeled.upperWidth / 2], [130, 1279, labeled.upperWidth / 2]),
    ]),
    component('screw', '승강 나사축 · 추정', 'mast', steel, [
      cylY(estimated.screwRadius, 200, 1039, 0, 85),
      ...Array.from({ length: 68 }, (_, index) => cylY(21, 214 + index * 12, 217 + index * 12, 0, 85, 24)),
    ], '숨은선의 반복 패턴을 나사축으로 해석. 실제 구동 방식과 나사산은 확인 필요.'),
    component('handle', '상부 굽힘 핸들', 'pushHandle', paint, [
      cylY(estimated.handleRadius, 1279, labeled.handleCenterHeight - estimated.handleBendRadius, 0, 122.5),
      torusArc([150, 1977, 122.5], 150, estimated.handleRadius, 'xy', Math.PI / 2, Math.PI / 2),
      cylX(estimated.handleRadius, 150, 400, labeled.handleCenterHeight, 122.5),
    ], '도면의 2127은 핸들 중심선 높이. 굽힘 반경과 관 두께는 추정.'),
    component('bumper', '하부 T형 가드', 'footBar', paint, [
      cylX(24.3, -565, -65, 260, 0), cylZ(24.3, -304, 304, -565, 260),
    ]),
    component('lever', '측면 레버 · 추정', 'mast', steel, [
      box([-382, 1080, 245], [-65, 1105, 261]),
      cylZ(25, 245, 261, -382, 1092.5),
    ]),
  ]
}

const buildDrives = (): PartSpec[] => [
  component('lift-reducer', '승강 감속기 / 플랜지', 'liftDrive', motor, [
    box([-100, 1279, -205], [85, 1365, 32]),
    cylY(94, 1365, 1385, -30, -65),
    cylY(60, 1385, 1434, -30, -65),
  ]),
  component('lift-motor', '승강 모터 · 1.5kW × 1/20', 'liftDrive', motor, [
    cylY(86, 1434, 1599, -30, -65, 48),
    cylY(100, 1599, 1676, -30, -65, 48),
    box([42, 1460, -100], [95, 1520, -30]),
    ...Array.from({ length: 24 }, (_, index) => {
      const angle = index * Math.PI * 2 / 24
      return cylY(5, 1445, 1590, -30 + 90 * Math.cos(angle), -65 + 90 * Math.sin(angle), 8)
    }),
  ], '모터 표기는 도면에서 확인. 외형, 방열핀 수, 단자함은 단순화.'),
  component('rotation-motor', '회전 모터 · 1.5kW × 2P', 'spindleDrive', motor, [
    cylX(73, -350, -205, 527, 0, 48),
    cylX(76, -430, -350, 527, 0, 48),
    cylX(88, -205, -190, 527, 0, 48),
    cylX(37, -190, -122, 527, 0),
    box([-340, 600, -40], [-245, 648, 40]),
    ...Array.from({ length: 20 }, (_, index) => {
      const angle = index * Math.PI * 2 / 20
      return cylX(4, -348, -212, 527 + 75 * Math.cos(angle), 75 * Math.sin(angle), 8)
    }),
  ]),
]

const buildCrosshead = (): PartSpec[] => [
  component('crosshead', '크로스헤드 / 가이드 슬리브', 'carriage', paint, [
    ...[-1, 1].map((side) => box([-122, 427, side * 166 - 16], [122, 927, side * 166 + 16])),
    box([-122, 427, -182], [-100, 927, 182]),
    box([100, 427, -182], [122, 927, 182]),
  ]),
  component('crosshead-bolts', '가이드 체결부', 'carriage', steel,
    [-1, 1].flatMap((side) => [449, 898].map((height) => cylX(14, 122, 135, height, side * 160, 6)))),
  component('bearing', '스핀들 지지 / 베어링 플랜지', 'carriage', steel, [
    box([122, 427, -100], [180, 627, 100]),
    cylX(98, 180, 222, 527, 0, 48),
    cylX(64, 222, 265, 527, 0, 48),
    ...boltRing(78, 8, 222, 527, 0),
  ]),
  component('shaft', '수평 스핀들', 'carriage', steel, [cylX(35.5, 265, 854, 527, 0, 48)]),
]

const buildReel = (): PartSpec[] => {
  const { labeled, estimated } = ASTRA_DIMENSIONS
  const axisHeight = labeled.spindleHeight
  const startX = estimated.reelStartX
  const endX = startX + labeled.reelWidth
  const thickness = estimated.flangeThickness
  const spin = { axis: 'x' as const, pivot: [0, axisHeight, 0] as Vec3 }
  return [
    component('reel-core', '릴 권취 코어 · 추정', 'reel', steel, [
      cylX(estimated.coreRadius, startX + thickness, endX - thickness, axisHeight, 0, 64),
    ]),
    ...[startX, endX - thickness].map((flangeX, index) => component(`reel-flange-${index}`, '릴 플랜지 · Ø610', 'reel', steel, [
      cylX(labeled.reelFlangeDiameter / 2, flangeX, flangeX + thickness, axisHeight, 0, 96),
    ], '도면 지름 610 및 플랜지 바깥면 간격 400. 판 두께는 추정.')),
    component('reel-end', '외측 디스크 · Ø710', 'reel', steel, [
      cylX(labeled.reelEndDiameter / 2, endX + 1, endX + 16, axisHeight, 0, 96),
      cylX(342, endX + 16, endX + 52, axisHeight, 0, 96),
      cylX(147.5, endX + 52, endX + 65, axisHeight, 0, 64),
      ...boltRing(118, 8, endX + 65, axisHeight, 0),
    ]),
    component('reel-lock', '스핀들 고정 너트', 'reel', motor, [cylX(28, 838, 863, axisHeight, 0, 6)]),
    component('reel-marker', '회전 표시 · 시연용', 'reel', yellow, [
      box([825, axisHeight + 160, -9], [827, axisHeight + 305, 9]),
    ], '회전을 알아보기 위한 표시이며 원도면에는 없는 요소.'),
  ].map((part) => ({ ...part, spin }))
}

export const buildAstraLifter = (): AssemblySpec => {
  const parts = [
    ...buildBase(), ...buildMast(), ...buildDrives(), ...buildCrosshead(), ...buildReel(),
    component('panel', '조작함 · 부착위치 기준', 'panel', motor, [
      box([-45, 1153, 267], [50, 1373, 367]),
      box([-25, 1210, 235], [25, 1250, 267]),
    ], '도면은 조작판넬 부착위치를 표시. 상자 형상과 버튼 구성은 추정.'),
    component('panel-stop', '정지 버튼 · 추정', 'panel', '#bb433c', [cylZ(13, 367, 380, 0, 1330)]),
    component('panel-run', '조작 버튼 · 추정', 'panel', '#6aa978', [
      cylZ(9, 367, 375, -15, 1285), cylZ(9, 367, 375, 15, 1285),
    ]),
  ]
  return { parts, bounds: parts.map((part) => boundsOf(part.shapes)).reduce(mergeBounds) }
}