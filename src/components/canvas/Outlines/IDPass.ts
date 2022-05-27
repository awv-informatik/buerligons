import * as THREE from 'three'
import { Pass, Selection } from 'postprocessing'

const vertexCode = `
  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;

  attribute vec3 position;

  void main()	{
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentCode = `
  uniform lowp vec3 idColor;
  
  void main() {
    gl_FragColor.rgb = idColor;
  }
`

export class IDPass extends Pass {
  material: THREE.RawShaderMaterial
  oldMaterials: Map<THREE.Mesh, THREE.Material>
  selection: Selection
  id: number
  channel: number

  constructor(scene: THREE.Scene, camera: THREE.Camera) {
  	super('IDPass', scene, camera)
  
  	this.needsSwap = false

    this.material = new THREE.RawShaderMaterial({
      uniforms: {
        idColor: new THREE.Uniform(new THREE.Color(0xff0000)),
      },
      depthWrite: false,
      depthTest: false,
      vertexShader: vertexCode,
      fragmentShader: fragmentCode,
    })

    this.oldMaterials = new Map<THREE.Mesh, THREE.Material>()
    this.selection = new Selection()
    this.id = 0
    this.channel = 0
  }

  render(renderer: THREE.WebGLRenderer, inputBuffer: THREE.WebGLRenderTarget) {
    const scene = this.scene
    const camera = this.camera
    const mask = camera.layers.mask
    const background = scene.background
    const shadowMapAutoUpdate = renderer.shadowMap.autoUpdate
  
    renderer.shadowMap.autoUpdate = false
    scene.background = null

    const color = [0.0, 0.0, 0.0]
    color[this.channel] = this.id / 256.0
    this.material.uniforms.idColor.value = new THREE.Color(...color)

    this.selection.forEach(mesh_ => {
      const mesh = mesh_ as THREE.Mesh
      this.oldMaterials.set(mesh, mesh.material as THREE.Material)
      mesh.material = this.material
    })
  
  	renderer.setRenderTarget(inputBuffer)
  	renderer.render(scene, camera)

    for(const entry of this.oldMaterials) {
      entry[0].material = entry[1]
    }

    this.oldMaterials.clear()

  	camera.layers.mask = mask
  	scene.background = background
  	renderer.shadowMap.autoUpdate = shadowMapAutoUpdate
  }
}
