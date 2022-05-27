import * as THREE from 'three'
import { Effect, ClearPass, KawaseBlurPass, ShaderPass, Selection, Resolution, KernelSize, BlendFunction } from 'postprocessing'
import { IDPass } from './IDPass'
import { OutlineMaterial } from './OutlineMaterial'

const fragmentCode = `
  uniform lowp sampler2D edgeTexture;
  
  uniform float edgeStrength;
  uniform vec3 edgeColor1;
  uniform vec3 edgeColor2;
  uniform vec3 edgeColor3;
  
  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  	vec3 edge = texture2D(edgeTexture, uv).rgb * edgeStrength;

  	vec3 color = vec3(0.0, 0.0, 0.0);
    if (edge.r <= edge.b && edge.g <= edge.b) {
      color = edgeColor3;
    }
    else if (edge.r <= edge.g && edge.b <= edge.g) {
      color = edgeColor2;
    }
    else {
      color = edgeColor1;
    }

    float alpha = 3.0 * max(max(edge.r, edge.g), edge.b) - 2.0;
    if (alpha < 0.4) {
      alpha = 0.0;
    }

  	outputColor = vec4(color, alpha);
  }
`

export class OutlineEffect extends Effect {
  scene: THREE.Scene
  camera: THREE.Camera
  idRT: THREE.WebGLRenderTarget
  outlineRT: THREE.WebGLRenderTarget
  clearPass: ClearPass
  idPass: IDPass
  outlinePass: ShaderPass
  blurPass: KawaseBlurPass
  selections1: Selection[]
  selections2: Selection[]
  selections3: Selection[]
  time: number

  processSelection: (renderer: THREE.WebGLRenderer, selection: Selection, id: number) => void

  constructor(scene: THREE.Scene, camera: THREE.Camera, {
    edgeStrength = 1.0,
    edgeColor1 = 0xffffff,
    edgeColor2 = 0xffffff,
    edgeColor3 = 0xffffff,
    resolutionScale = 0.5,
    width = Resolution.AUTO_SIZE,
    height = Resolution.AUTO_SIZE,
    kernelSize = KernelSize.VERY_SMALL,
  } = {}) {
    super("OutlineEffect", fragmentCode, {
      uniforms: new Map([
        ["edgeTexture", new THREE.Uniform(null)],
        ["edgeStrength", new THREE.Uniform(edgeStrength)],
        ["edgeColor1", new THREE.Uniform(new THREE.Color(edgeColor1))],
        ["edgeColor2", new THREE.Uniform(new THREE.Color(edgeColor2))],
        ["edgeColor3", new THREE.Uniform(new THREE.Color(edgeColor3))],
      ])
    })
    
		this.blendMode.setBlendFunction(BlendFunction.ALPHA);

    this.scene = scene
    this.camera = camera

    this.idRT = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: false,
      stencilBuffer: false,
    })
    this.idRT.texture.name = "Outline.IDs"

    this.outlineRT = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
    })
    this.outlineRT.texture.name = "Outline.Edges"
    const edgeTexture = this.uniforms.get("edgeTexture") as THREE.Uniform
    edgeTexture.value = this.outlineRT.texture

    this.clearPass = new ClearPass()
    this.clearPass.overrideClearColor = new THREE.Color(0x000000)
    this.clearPass.overrideClearAlpha = 0

    this.idPass = new IDPass(scene, camera)

    this.outlinePass = new ShaderPass(new OutlineMaterial())
    const outlineMaterial = this.outlinePass.fullscreenMaterial as OutlineMaterial
    outlineMaterial.inputBuffer = this.idRT.texture

    this.blurPass = new KawaseBlurPass({ resolutionScale, width, height, kernelSize })
    const resolution = this.blurPass.resolution
    resolution.addEventListener("change", (e) => this.setSize(resolution.baseWidth, resolution.baseHeight))

    this.time = 0

    this.selections1 = []
    this.selections2 = []
    this.selections3 = []

    this.processSelection = (renderer: THREE.WebGLRenderer, selection: Selection, id: number) => {
      selection.layer++

      this.idPass.id = id
      this.idPass.selection = selection
      this.idPass.render(renderer, this.idRT)

      selection.layer--
      
      this.outlinePass.render(renderer, null as any, this.outlineRT)
    }
  }

	set selectionLayer(value: number) {
		this.selections1.forEach(selection => {
      selection.layer = value
    })
		this.selections2.forEach(selection => {
      selection.layer = value
    })
		this.selections3.forEach(selection => {
      selection.layer = value
    })
	}

  update(renderer: THREE.WebGLRenderer, inputBuffer: THREE.WebGLRenderTarget, deltaTime: number) {
    const scene = this.scene
    const camera = this.camera
    const selections1 = this.selections1
    const selections2 = this.selections2
    const selections3 = this.selections3

    const background = scene.background
    const mask = camera.layers.mask

    if (selections1.length > 0 || selections2.length > 0 || selections3.length > 0) {
      scene.background = null

      this.time += deltaTime

      const layer = selections1[0]?.layer || selections2[0]?.layer || selections3[0]?.layer
      camera.layers.set(layer + 1)

      this.clearPass.render(renderer, this.idRT, null as any)
      this.clearPass.render(renderer, this.outlineRT, null as any)

      const offset1 = 1
      const offset2 = offset1 + this.selections1.length
      const offset3 = offset2 + this.selections2.length

      this.idPass.channel = 0
      this.selections1.forEach((selection, i) => this.processSelection(renderer, selection, offset1 + i))
      
      this.idPass.channel = 1
      this.selections2.forEach((selection, i) => this.processSelection(renderer, selection, offset2 + i))
      
      this.idPass.channel = 2
      this.selections3.forEach((selection, i) => this.processSelection(renderer, selection, offset3 + i))

      // Restore the camera layer mask and the scene background.
      camera.layers.mask = mask
      scene.background = background

      if(this.blurPass.enabled) {
        this.blurPass.render(renderer, this.outlineRT, this.outlineRT)
      }
    }
    else if (this.time > 0) {
      this.clearPass.render(renderer, this.idRT, null as any)
      this.clearPass.render(renderer, this.outlineRT, null as any)
      this.time = 0
    }
  }

  setSize(width: number, height: number) {
    this.blurPass.setSize(width, height)
    this.idRT.setSize(width, height)

    const resolution = this.blurPass.resolution
    resolution.setBaseSize(width, height)
    const w = resolution.width, h = resolution.height

    this.outlineRT.setSize(w, h)

    const outlineMaterial = this.outlinePass.fullscreenMaterial as OutlineMaterial
    outlineMaterial.setSize(w, h)
  }

  initialize(renderer: THREE.WebGLRenderer, alpha: boolean, frameBufferType?: number) {
    // No need for high precision: the blur pass operates on a mask texture.
    this.blurPass.initialize(renderer, alpha, THREE.UnsignedByteType);

    if(frameBufferType !== undefined) {
      // These passes ignore the buffer type.
      this.idPass.initialize(renderer, alpha, frameBufferType);
      this.outlinePass.initialize(renderer, alpha, frameBufferType);
    }
  }
}
