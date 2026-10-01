/**
 * Dimensions (mm) extracted from LFT-630-00-00.DWG.
 * Machine frame: X = along the spindle (reel side is +X), Y = up (floor = 0),
 * Z = machine width (operator / control-panel side is +Z).
 */
export interface LifterParams {
  readonly overallHeight: number
  readonly baseLength: number
  readonly baseBeamHeight: number
  readonly baseBeamWidth: number
  readonly crossBeamWidth: number
  readonly wheelDiameter: number
  readonly wheelWidth: number
  readonly wheelCentersX: readonly [number, number]
  readonly wheelCenterZ: number

  readonly mastWidthX: number
  readonly mastDepthZ: number
  readonly mastBottomY: number
  readonly mastTopY: number
  readonly topHousingBottomY: number
  readonly topHousingHalfZ: number
  readonly topPlateThickness: number
  readonly topPlateHalfZ: number

  readonly spindleY: number
  readonly spindleDiameter: number
  readonly carriageHalfX: number
  readonly carriageBottomY: number
  readonly carriageTopY: number
  readonly carriageHalfZ: number
  readonly liftStroke: readonly [number, number]

  readonly reelCoreDiameter: number
  readonly reelCoreX: readonly [number, number]
  readonly reelFlangeDiameter: number
  readonly reelFlangeThickness: number
  readonly reelDishDiameter: number
  readonly reelRimDiameter: number
  readonly reelRimX: readonly [number, number]
  readonly reelHubDiameter: number

  readonly spindleMotorDiameter: number
  readonly spindleMotorX: readonly [number, number]

  readonly liftMotorCenter: readonly [number, number]
  readonly liftMotorDiameter: number
  readonly liftMotorY: readonly [number, number]

  readonly handleTubeDiameter: number
  readonly pushHandleZ: number
  readonly pushHandleBendY: number
  readonly pushHandleBendRadius: number
  readonly pushHandleEndX: number

  readonly footBarY: number
  readonly footBarEndX: number
  readonly footBarHalfZ: number

  readonly panelBox: { readonly x: readonly [number, number]; readonly y: readonly [number, number]; readonly z: readonly [number, number] }
}

export const LFT630: LifterParams = {
  overallHeight: 2127,
  baseLength: 1072,
  baseBeamHeight: 110,
  baseBeamWidth: 355,
  crossBeamWidth: 675,
  wheelDiameter: 152,
  wheelWidth: 40,
  wheelCentersX: [-350, 570],
  wheelCenterZ: 417.5,

  mastWidthX: 170,
  mastDepthZ: 355,
  mastBottomY: 126,
  mastTopY: 1264,
  topHousingBottomY: 1039,
  topHousingHalfZ: 252.5,
  topPlateThickness: 18,
  topPlateHalfZ: 262.5,

  spindleY: 527,
  spindleDiameter: 85,
  carriageHalfX: 122.5,
  carriageBottomY: 427,
  carriageTopY: 927,
  carriageHalfZ: 137.5,
  liftStroke: [-170, 110],

  reelCoreDiameter: 267,
  reelCoreX: [370, 746],
  reelFlangeDiameter: 610,
  reelFlangeThickness: 12,
  reelDishDiameter: 695,
  reelRimDiameter: 710,
  reelRimX: [774, 825],
  reelHubDiameter: 295,

  spindleMotorDiameter: 150,
  spindleMotorX: [-426, -208],

  liftMotorCenter: [-30, -65],
  liftMotorDiameter: 200,
  liftMotorY: [1440, 1595],

  handleTubeDiameter: 48.6,
  pushHandleZ: 122.5,
  pushHandleBendY: 1977,
  pushHandleBendRadius: 150,
  pushHandleEndX: 400,

  footBarY: 260,
  footBarEndX: -565,
  footBarHalfZ: 304,

  panelBox: { x: [-50, 50], y: [1153, 1373], z: [267, 372] },
}
