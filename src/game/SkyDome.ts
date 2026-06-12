import * as THREE from 'three';

/**
 * SkyDome
 * --------
 * Cielo procedural: cúpula con gradiente (cénit azul profundo → horizonte
 * cálido), disco solar con halo dorado y una banda de bruma sobre el mar.
 * Sustituye el color plano de fondo y le da profundidad al mundo.
 */
export class SkyDome {
  readonly mesh: THREE.Mesh;

  constructor(scene: THREE.Scene, sunDirection: THREE.Vector3) {
    const material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uSunDir: { value: sunDirection.clone().normalize() },
        uZenith: { value: new THREE.Color(0x2f8fd6) },   // azul cielo profundo
        uHorizon: { value: new THREE.Color(0x9fd8ea) },  // bruma turquesa
        uWarm: { value: new THREE.Color(0xffe8c0) },     // calidez junto al sol
        uSun: { value: new THREE.Color(0xfff3d0) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          // La cúpula sigue a la cámara: sin paralaje, como un cielo real
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = (projectionMatrix * mv).xyww; // siempre al fondo
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vDir;
        uniform vec3 uSunDir;
        uniform vec3 uZenith;
        uniform vec3 uHorizon;
        uniform vec3 uWarm;
        uniform vec3 uSun;
        void main() {
          float h = clamp(vDir.y, 0.0, 1.0);
          // Gradiente vertical con horizonte amplio
          vec3 sky = mix(uHorizon, uZenith, pow(h, 0.55));
          // Calidez direccional hacia el sol
          float toSun = clamp(dot(normalize(vDir), uSunDir), 0.0, 1.0);
          sky = mix(sky, uWarm, pow(toSun, 3.0) * 0.25);
          // Disco solar + halo suave (alimenta el bloom)
          float disc = smoothstep(0.9985, 0.9995, toSun);
          float halo = pow(toSun, 24.0) * 0.5;
          sky += uSun * (disc * 2.2 + halo);
          // Dither: rompe el banding del degradado (sin sin(): apto móvil)
          float dither = fract(dot(gl_FragCoord.xy, vec2(0.7548776662, 0.5698402909)));
          sky += (dither - 0.5) * (2.0 / 255.0);
          gl_FragColor = vec4(sky, 1.0);
        }
      `,
    });

    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), material);
    // Escala enorme + frustumCulled off: la posición xyww la fija al fondo
    this.mesh.scale.setScalar(1600);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1;
    scene.add(this.mesh);
  }
}
