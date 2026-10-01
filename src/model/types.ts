export type Vec3 = readonly [number, number, number]
export type Axis = 'x' | 'y' | 'z'

export type GroupId =
  | 'base'
  | 'mast'
  | 'liftDrive'
  | 'carriage'
  | 'spindleDrive'
  | 'reel'
  | 'pushHandle'
  | 'footBar'
  | 'panel'

export interface ShapeBox {
  readonly kind: 'box'
  readonly min: Vec3
  readonly max: Vec3
}

/** Cylinder along `axis`, starting at `start` and extending `length` in +axis. */
export interface ShapeCylinder {
  readonly kind: 'cylinder'
  readonly axis: Axis
  readonly radius: number
  readonly start: Vec3
  readonly length: number
  readonly segments?: number
}

/** Partial torus (pipe bend). `plane` is the plane the ring lies in. */
export interface ShapeTorusArc {
  readonly kind: 'torusArc'
  readonly center: Vec3
  readonly majorRadius: number
  readonly tubeRadius: number
  readonly plane: 'xy' | 'yz' | 'xz'
  readonly startAngle: number
  readonly arc: number
}

export type Shape = ShapeBox | ShapeCylinder | ShapeTorusArc

export interface PartSpec {
  readonly id: string
  readonly name: string
  readonly group: GroupId
  readonly color: string
  readonly shapes: readonly Shape[]
  readonly description?: string
  /** Rotation pivot (world mm) for spinning parts. */
  readonly spin?: { readonly axis: Axis; readonly pivot: Vec3 }
  readonly metalness?: number
  readonly roughness?: number
}

export interface Bounds {
  readonly min: Vec3
  readonly max: Vec3
}

export interface AssemblySpec {
  readonly parts: readonly PartSpec[]
  readonly bounds: Bounds
}
