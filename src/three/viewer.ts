import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { AssemblySpec, GroupId } from '../model/types'
import type { LifterParams } from '../model/params'
import type { PoseState } from '../model/kinematics'
import { applyPose, buildSceneModel, setGroupVisibility, setHighlight, type SceneModel } from './buildModel'

export type ViewPreset = 'iso' | 'front' | 'side' | 'top' | 'back'

export interface Viewer {
  readonly model: SceneModel
  setPose(state: PoseState): void
  setSelected(partId: string | null): void
  setVisibleGroups(groups: ReadonlySet<GroupId> | null): void
  setAutoRotate(on: boolean): void
  setView(preset: ViewPreset): void
  frameAll(): void
  onPick(cb: (partId: string | null) => void): void
  dispose(): void
}

const MM = 0.001

export const createViewer = (canvas: HTMLCanvasElement, spec: AssemblySpec, params: LifterParams): Viewer => {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05

  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#eef1f5')
  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture

  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 100)
  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.maxPolarAngle = Math.PI * 0.52
  controls.autoRotateSpeed = 1.2

  const hemi = new THREE.HemisphereLight('#ffffff', '#8a9099', 0.6)
  scene.add(hemi)
  const sun = new THREE.DirectionalLight('#ffffff', 2.2)
  sun.position.set(3, 5, 2.5)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.near = 0.5
  sun.shadow.camera.far = 20
  sun.shadow.camera.left = sun.shadow.camera.bottom = -3
  sun.shadow.camera.right = sun.shadow.camera.top = 3
  sun.shadow.bias = -0.0005
  scene.add(sun)
  const fill = new THREE.DirectionalLight('#dfe8ff', 0.6)
  fill.position.set(-4, 2, -3)
  scene.add(fill)

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(6, 64),
    new THREE.ShadowMaterial({ opacity: 0.28 }),
  )
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)
  const grid = new THREE.GridHelper(8, 32, '#b9c2cf', '#d5dbe3')
  ;(grid.material as THREE.Material).transparent = true
  ;(grid.material as THREE.Material).opacity = 0.6
  grid.position.y = 0.0005
  scene.add(grid)

  const model = buildSceneModel(spec)
  model.root.scale.setScalar(MM)
  scene.add(model.root)

  const center = new THREE.Vector3(
    (spec.bounds.min[0] + spec.bounds.max[0]) / 2,
    (spec.bounds.min[1] + spec.bounds.max[1]) / 2,
    (spec.bounds.min[2] + spec.bounds.max[2]) / 2,
  ).multiplyScalar(MM)
  const size = new THREE.Vector3(
    spec.bounds.max[0] - spec.bounds.min[0],
    spec.bounds.max[1] - spec.bounds.min[1],
    spec.bounds.max[2] - spec.bounds.min[2],
  ).multiplyScalar(MM)
  const radius = size.length() / 2
  let explodeFactor = 0

  const distanceFor = () => {
    const halfVerticalFov = THREE.MathUtils.degToRad(camera.fov) / 2
    const halfFov = Math.atan(Math.tan(halfVerticalFov) * Math.min(camera.aspect, 1))
    return radius * (1 + explodeFactor * 0.55) / Math.sin(halfFov) * 1.05
  }

  const setView = (preset: ViewPreset) => {
    const d = distanceFor()
    const dir = {
      iso: new THREE.Vector3(1, 0.55, 1).normalize(),
      front: new THREE.Vector3(0, 0.12, 1).normalize(),
      side: new THREE.Vector3(1, 0.12, 0).normalize(),
      back: new THREE.Vector3(-1, 0.12, -0.6).normalize(),
      top: new THREE.Vector3(0.01, 1, 0.01).normalize(),
    }[preset]
    camera.position.copy(center).addScaledVector(dir, d)
    controls.target.copy(center)
    controls.update()
  }

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = canvas
    if (w === 0 || h === 0) return
    const previousDistance = distanceFor()
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    camera.position.sub(controls.target).multiplyScalar(distanceFor() / previousDistance).add(controls.target)
  }
  const ro = new ResizeObserver(resize)
  ro.observe(canvas)
  resize()
  setView('iso')

  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  let pickCb: ((id: string | null) => void) | null = null
  let downAt: { x: number; y: number } | null = null
  const onDown = (e: PointerEvent) => {
    downAt = { x: e.clientX, y: e.clientY }
  }
  const onUp = (e: PointerEvent) => {
    if (!downAt || !pickCb) return
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y)
    downAt = null
    if (moved > 4) return
    const rect = canvas.getBoundingClientRect()
    pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
    raycaster.setFromCamera(pointer, camera)
    const hit = raycaster.intersectObject(model.root, true).find((h) => h.object.visible)
    pickCb((hit?.object.userData.partId as string | undefined) ?? null)
  }
  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointerup', onUp)

  let disposed = false
  const loop = () => {
    if (disposed) return
    controls.update()
    renderer.render(scene, camera)
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)

  return {
    model,
    setPose: (state) => {
      const prev = explodeFactor
      explodeFactor = state.explode
      applyPose(model, state, params)
      if (Math.abs(prev - explodeFactor) > 1e-6) {
        const dir = camera.position.clone().sub(controls.target).normalize()
        camera.position.copy(controls.target).addScaledVector(dir, distanceFor())
      }
    },
    setSelected: (id) => setHighlight(model, id),
    setVisibleGroups: (groups) => setGroupVisibility(model, groups),
    setAutoRotate: (on) => {
      controls.autoRotate = on
    },
    setView,
    frameAll: () => setView('iso'),
    onPick: (cb) => {
      pickCb = cb
    },
    dispose: () => {
      disposed = true
      ro.disconnect()
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointerup', onUp)
      controls.dispose()
      pmrem.dispose()
      renderer.dispose()
    },
  }
}
