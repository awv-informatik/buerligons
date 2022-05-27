import * as THREE from "three";

const vertexCode = `
  uniform vec2 texelSize;
  
  varying vec2 vUv0;
  varying vec2 vUv1;
  varying vec2 vUv2;
  varying vec2 vUv3;
  
  void main() {
    vec2 uv = position.xy * 0.5 + 0.5;
    
    vUv0 = vec2(uv.x + texelSize.x, uv.y);
    vUv1 = vec2(uv.x - texelSize.x, uv.y);
    vUv2 = vec2(uv.x, uv.y + texelSize.y);
    vUv3 = vec2(uv.x, uv.y - texelSize.y);
    
    gl_Position = vec4(position.xy, 1.0, 1.0);
  }
`

const fragmentCode = `
  uniform lowp sampler2D inputBuffer;
  
  varying vec2 vUv0;
  varying vec2 vUv1;
  varying vec2 vUv2;
  varying vec2 vUv3;
  
  void main() {
    vec3 c0 = texture2D(inputBuffer, vUv0).rgb;
    vec3 c1 = texture2D(inputBuffer, vUv1).rgb;
    vec3 c2 = texture2D(inputBuffer, vUv2).rgb;
    vec3 c3 = texture2D(inputBuffer, vUv3).rgb;
    
    if (c0 == c1 && c0 == c2 && c0 == c3) {
      discard;
    }

    if (c0.b > 0.0 || c1.b > 0.0 || c2.b > 0.0 || c3.b > 0.0) {
      gl_FragColor = vec4(0.0, 0.0, 1.0, 1.0);
    }
    else if (c0.g > 0.0 || c1.g > 0.0 || c2.g > 0.0 || c3.g > 0.0) {
      gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0);
    }
    else {
      gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
    }
  }
`

export class OutlineMaterial extends THREE.ShaderMaterial {
  constructor(texelSize = new THREE.Vector2()) {  
    super({
      name: "OutlineMaterial",
      uniforms: {
        inputBuffer: new THREE.Uniform(null),
        texelSize: new THREE.Uniform(new THREE.Vector2()),
        channel: new THREE.Uniform(new THREE.Color(0xff0000))
      },
      blending: THREE.NoBlending,
      depthWrite: false,
      depthTest: false,
      vertexShader: vertexCode,
      fragmentShader: fragmentCode,
  	})

    this.toneMapped = false
  	this.setTexelSize(texelSize.x, texelSize.y)
    this.uniforms.maskTexture = this.uniforms.inputBuffer
  }

  set inputBuffer(value: THREE.Texture) {
    this.uniforms.inputBuffer.value = value
  }

  setTexelSize(x: number, y: number) {
    this.uniforms.texelSize.value.set(x, y)
  }

  setSize(width: number, height: number) {
    this.uniforms.texelSize.value.set(1.0 / width, 1.0 / height)
  }
}
