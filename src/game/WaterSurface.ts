import * as THREE from 'three';

/** Isla para la espuma de la orilla (elipse aproximada). */
export interface IslandShore {
  x: number;
  z: number;
  rx: number;
  rz: number;
}

/**
 * WaterSurface
 * -------------
 * Mar caribeño con shader propio: gradiente de profundidad (turquesa claro
 * junto a las islas → azul profundo a lo lejos), fresnel hacia el horizonte,
 * caustics animados, destellos del sol y espuma blanca ondulante alrededor
 * de cada isla. Reemplaza el plano azul plano del prototipo.
 */
export class WaterSurface {
  private material: THREE.ShaderMaterial;

  constructor(scene: THREE.Scene, shores: IslandShore[], sunDirection: THREE.Vector3) {
    // Hasta 6 islas como uniforms (x, z, rx, rz)
    const islandData: THREE.Vector4[] = [];
    for (let i = 0; i < 6; i++) {
      const s = shores[i];
      islandData.push(s ? new THREE.Vector4(s.x, s.z, s.rx, s.rz) : new THREE.Vector4(0, 0, -1, -1));
    }

    this.material = new THREE.ShaderMaterial({
      transparent: true,
      fog: false,
      uniforms: {
        uTime: { value: 0 },
        uShallow: { value: new THREE.Color(0x5fd6c8) },  // turquesa orilla
        uDeep: { value: new THREE.Color(0x0e5f7a) },     // azul profundo
        uSky: { value: new THREE.Color(0xbfe9f0) },      // reflejo del cielo
        uSunDir: { value: sunDirection.clone().normalize() },
        uIslands: { value: islandData },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        varying vec3 vViewDir;
        uniform float uTime;
        void main() {
          vec3 pos = position;
          // Olas suaves de gran escala (vertical en el plano rotado = z local)
          vec4 world = modelMatrix * vec4(pos, 1.0);
          world.y += sin(world.x * 0.25 + uTime * 0.9) * 0.05
                   + cos(world.z * 0.21 - uTime * 0.7) * 0.05;
          vWorld = world.xyz;
          vViewDir = normalize(cameraPosition - world.xyz);
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vWorld;
        varying vec3 vViewDir;
        uniform float uTime;
        uniform vec3 uShallow;
        uniform vec3 uDeep;
        uniform vec3 uSky;
        uniform vec3 uSunDir;
        uniform vec4 uIslands[6];

        // Pseudo-ruido barato para caustics
        float wave(vec2 p) {
          return sin(p.x) * sin(p.y);
        }

        // Noise para las sombras de nubes sobre el mar
        float hash2(vec2 p) {
          vec3 p3 = fract(vec3(p.xyx) * 0.1031);
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.x + p3.y) * p3.z);
        }
        float noise2(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), u.x),
                     mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), u.x), u.y);
        }

        void main() {
          // Distancia elíptica a la isla más cercana (1 = su orilla)
          float nearest = 10.0;
          for (int i = 0; i < 6; i++) {
            if (uIslands[i].z < 0.0) continue;
            vec2 d = (vWorld.xz - uIslands[i].xy) / uIslands[i].zw;
            nearest = min(nearest, length(d));
          }

          // ---- CAPA 1: color por profundidad en 3 tonos (Coastal World) ----
          // orilla clarísima → banda turquesa media → azul profundo
          vec3 mid = mix(uShallow, uDeep, 0.45);
          vec3 color = mix(uShallow, mid, smoothstep(0.85, 1.25, nearest));
          color = mix(color, uDeep, smoothstep(1.25, 2.1, nearest));
          float depthMix = smoothstep(0.85, 1.9, nearest);

          // Detalle fino solo de cerca: lejos alasea en franjas, así que se funde
          float camDist = distance(cameraPosition, vWorld);
          float detailFade = 1.0 - smoothstep(28.0, 65.0, camDist);

          // Caustics: vivos en la banda media/poca profundidad
          float c1 = wave(vWorld.xz * 0.9 + vec2(uTime * 0.5, uTime * 0.35));
          float c2 = wave(vWorld.xz * 1.7 - vec2(uTime * 0.4, uTime * 0.6) + 3.1);
          float caustic = pow(max(c1 * c2, 0.0), 2.0);
          color += vec3(0.35, 0.5, 0.5) * caustic * (1.0 - depthMix) * 0.6 * detailFade;

          // ---- CAPA 2: espuma doble ----
          // Banda nítida pegada a la orilla, ondulando
          float edgeWobble = sin(uTime * 1.4 + vWorld.x * 0.4 + vWorld.z * 0.3) * 0.03;
          float foamEdge = 1.0 - smoothstep(0.0, 0.10, abs(nearest - (0.99 + edgeWobble)));
          // Segunda banda suave más afuera, con su propio ritmo (ola rompiendo)
          float ripWobble = sin(uTime * 0.9 + vWorld.z * 0.5 - vWorld.x * 0.2) * 0.05;
          float foamRip = (1.0 - smoothstep(0.0, 0.14, abs(nearest - (1.22 + ripWobble)))) * 0.5;
          // Ruptura orgánica de la espuma con noise
          float foamBreak = mix(0.7, smoothstep(0.32, 0.75, noise2(vWorld.xz * 1.4 + uTime * 0.35)), detailFade);
          float foam = clamp((foamEdge + foamRip) * foamBreak * 1.4, 0.0, 1.0);
          color = mix(color, vec3(0.97, 1.0, 0.99), foam * 0.9);

          // ---- CAPA 3: cielo, sol y sombras de nubes ----
          float fresnel = pow(1.0 - clamp(dot(vViewDir, vec3(0.0, 1.0, 0.0)), 0.0, 1.0), 2.2);
          color = mix(color, uSky, fresnel * 0.7);
          vec3 reflectDir = reflect(-vViewDir, normalize(vec3(c1 * 0.08, 1.0, c2 * 0.08)));
          float glint = pow(max(dot(reflectDir, uSunDir), 0.0), 90.0);
          color += vec3(1.0, 0.95, 0.8) * glint * 0.9 * detailFade;
          // Las mismas nubes falsas del terreno también ensombrecen el mar
          vec2 cuv = vWorld.xz * 0.016 + vec2(uTime * 0.014, uTime * 0.007);
          float cn = noise2(cuv) * 0.65 + noise2(cuv * 2.6 + 13.0) * 0.35;
          color *= mix(1.0, 0.78, smoothstep(0.52, 0.80, cn));

          // Dither anti-banding (sin sin(): estable en GPUs móviles)
          float dither = fract(dot(gl_FragCoord.xy, vec2(0.7548776662, 0.5698402909)));
          color += (dither - 0.5) * (2.0 / 255.0);
          float alpha = 0.92 - (1.0 - depthMix) * 0.12;
          gl_FragColor = vec4(color, alpha);
        }
      `,
    });

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(360, 360, 1, 1), this.material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.12;
    scene.add(mesh);
  }

  update(dt: number): void {
    this.material.uniforms.uTime.value += dt;
  }
}
