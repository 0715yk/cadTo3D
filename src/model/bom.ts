import type { AssemblySpec, GroupId, PartSpec } from './types'
import { GROUP_LABELS } from './kinematics'

export interface BomRow {
  readonly group: GroupId
  readonly groupLabel: string
  readonly parts: readonly PartSpec[]
}

export const groupOrder: readonly GroupId[] = [
  'base',
  'mast',
  'liftDrive',
  'carriage',
  'spindleDrive',
  'reel',
  'pushHandle',
  'footBar',
  'panel',
]

export const buildBom = (spec: AssemblySpec): readonly BomRow[] =>
  groupOrder
    .map((group) => ({ group, groupLabel: GROUP_LABELS[group], parts: spec.parts.filter((p) => p.group === group) }))
    .filter((row) => row.parts.length > 0)

export const findPart = (spec: AssemblySpec, id: string): PartSpec | undefined => spec.parts.find((p) => p.id === id)

export const MACHINE_INFO = {
  drawingNo: 'LFT-630-00-00',
  title: "610 LIFTER — CROSS HEAD PART ASS'Y",
  company: '(주)진양기계제작소',
  line: 'AUTOMOTIVE LINE',
  designer: 'J.I.HONG',
  date: '2017-05-22',
  specs: [
    ['전고', '2,127 mm'],
    ['전장 (바퀴 외측)', '1,072 mm'],
    ['전폭 (바퀴 외측)', '875 mm'],
    ['마스트 높이', '1,261 mm'],
    ['적재 릴', 'Ø610 / Ø710 × 400'],
    ['리프트 모터', 'AC 기어드 1.5kW × 1/20 (삼양 V153-015)'],
    ['스핀들 모터', 'AC 1.5kW × 2P'],
    ['캐스터', 'Ø152 × 4'],
  ] as const,
} as const
