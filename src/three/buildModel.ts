import * as THREE from 'three'
import type { AssemblySpec, GroupId, PartSpec, Shape, Vec3 } from '../model/types'
import type { LifterParams } from '../model/params'
import { groupTranslation, type PoseState } from '../model/kinematics'

export interface PartNode {
  readonly spec: PartSpec
  readonly object: THREE.Group
  readonly spinPivot?: THREE.Object3D
  readonly meshes: readonly THREE.Mesh[]
}

export interface SceneModel {
  readonly root: THREE.Group
  readonly groups: ReadonlyMap<GroupId, THREE.Group>
  readonly parts: ReadonlyMap<string, PartNode>
}

const materialCache = new Map<string, THREE.MeshStandardMaterial>()

const materialFor = (spec: PartSpec): THREE.MeshStandardMaterial => {
  const key = `${spec.color}|${spec.metalness ?? 0.4}|${spec.roughness ?? 0.55}`
  const cached = materialCache.get(key)
  if (cached) return cached
  const m = new THREE.MeshStandardMaterial({
    color: new THREE.Color(spec.color),
    metalness: spec.metalness ?? 0.4,
    roughness: spec.roughness ?? 0.55,
  })
  materialCache.set(key, m)
  return m
}

const v3 = (v: Vec3) => new THREE.Vector3(v[0], v[1], v[2])

const geometryFor = (s: Shape): { geometry: THREE.BufferGeometry; position: THREE.Vector3 } => {
  switch (s.kind) {
    case 'box': {
      const size = v3(s.max).sub(v3(s.min))
      const geometry = new THREE.BoxGeometry(size.x, size.y, size.z)
      return { geometry, position: v3(s.min).add(size.multiplyScalar(0.5)) }
    }
    case 'cylinder': {
      const geometry = new THREE.CylinderGeometry(s.radius, s.radius, s.length, s.segments ?? 32)
      const half = s.length / 2
      const position = v3(s.start)
      if (s.axis === 'x') {
        geometry.rotateZ(-Math.PI / 2)
        position.x += half
      } else if (s.axis === 'z') {
        geometry.rotateX(Math.PI / 2)
        position.z += half
      } else {
        position.y += half
      }
      return { geometry, position }
    }
    case 'torusArc': {
      const geometry = new THREE.TorusGeometry(s.majorRadius, s.tubeRadius, 16, 64, s.arc)
      geometry.rotateZ(s.startAngle)
      if (s.plane === 'yz') geometry.rotateY(Math.PI / 2)
      else if (s.plane === 'xz') geometry.rotateX(Math.PI / 2)
      return { geometry, position: v3(s.center) }
    }
  }
}

const buildPart = (spec: PartSpec): PartNode => {
  const object = new THREE.Group()
  object.name = spec.id
  object.userData.partId = spec.id
  const material = materialFor(spec)
  const pivot = spec.spin ? new THREE.Object3D() : undefined
  if (pivot && spec.spin) {
    pivot.position.copy(v3(spec.spin.pivot))
    object.add(pivot)
  }
  const parent = pivot ?? object
  const meshes = spec.shapes.map((shape) => {
    const { geometry, position } = geometryFor(shape)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.copy(pivot ? position.sub(pivot.position) : position)
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.userData.partId = spec.id
    parent.add(mesh)
    return mesh
  })
  return pivot ? { spec, object, spinPivot: pivot, meshes } : { spec, object, meshes }
}

export const buildSceneModel = (spec: AssemblySpec): SceneModel => {
  const root = new THREE.Group()
  root.name = 'lifter'
  const groups = new Map<GroupId, THREE.Group>()
  const parts = new Map<string, PartNode>()
  for (const partSpec of spec.parts) {
    let group = groups.get(partSpec.group)
    if (!group) {
      group = new THREE.Group()
      group.name = partSpec.group
      groups.set(partSpec.group, group)
      root.add(group)
    }
    const node = buildPart(partSpec)
    group.add(node.object)
    parts.set(partSpec.id, node)
  }
  return { root, groups, parts }
}

export const applyPose = (model: SceneModel, state: PoseState, params: LifterParams): void => {
  for (const [groupId, group] of model.groups) {
    const t = groupTranslation(groupId, state, params)
    group.position.set(t[0], t[1], t[2])
  }
  for (const node of model.parts.values()) {
    if (node.spinPivot && node.spec.spin) {
      node.spinPivot.rotation.set(0, 0, 0)
      node.spinPivot.rotation[node.spec.spin.axis] = state.reelAngle
    }
  }
}

const highlightMaterial = new THREE.MeshStandardMaterial({
  color: new THREE.Color('#ffb020'),
  emissive: new THREE.Color('#ff8c00'),
  emissiveIntensity: 0.35,
  metalness: 0.3,
  roughness: 0.4,
})

export const setHighlight = (model: SceneModel, partId: string | null): void => {
  for (const node of model.parts.values()) {
    const material = node.spec.id === partId ? highlightMaterial : materialFor(node.spec)
    for (const mesh of node.meshes) mesh.material = material
  }
}

export const setGroupVisibility = (model: SceneModel, visible: ReadonlySet<GroupId> | null): void => {
  for (const [groupId, group] of model.groups) group.visible = visible === null || visible.has(groupId)
}
