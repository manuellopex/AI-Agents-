import * as THREE from 'three';

/**
 * CloudShadows — la técnica estrella de Coastal World
 * -----------------------------------------------------
 * Sombras de nubes FALSAS proyectadas sobre el terreno: un noise que se
 * desplaza lentamente oscurece el albedo en parches suaves. Cuesta casi
 * nada (puro shader, sin texturas ni luces) y hace que la isla se sienta
 * viva y enorme. En el mismo parche se añaden los matices de color tipo
 * "splat": variación sutil de tono por noise, como pintura irregular.
 *
 * Se inyecta en MeshStandardMaterial con onBeforeCompile, así el material
 * conserva PBR, sombras reales, niebla y environment map.
 */

/** Tiempo compartido por todos los materiales parcheados (lo avanza el GameManager). */
export const cloudTimeUniform = { value: 0 };

const NOISE_GLSL = /* glsl */ `
  varying vec3 vCloudWorld;
  uniform float uCloudTime;
  float cwHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float cwNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(cwHash(i), cwHash(i + vec2(1.0, 0.0)), u.x),
               mix(cwHash(i + vec2(0.0, 1.0)), cwHash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
`;

/**
 * Parchea un material estándar con sombras de nubes + matices de color.
 * @param splatNuance añade también la variación de tono del terreno
 */
export function applyCloudShadows(material: THREE.MeshStandardMaterial, splatNuance = false): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uCloudTime = cloudTimeUniform;

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCloudWorld;')
      .replace('#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvCloudWorld = (modelMatrix * vec4( transformed, 1.0 )).xyz;');

    const nuanceBlock = splatNuance ? /* glsl */ `
        // Matices tipo splat: parches de tono y grano fino (Coastal World)
        float cwTint = cwNoise(vCloudWorld.xz * 0.07 + 5.0);
        diffuseColor.rgb = mix(diffuseColor.rgb,
          diffuseColor.rgb * vec3(0.90, 1.07, 0.88),
          smoothstep(0.45, 0.72, cwTint) * 0.45);
        diffuseColor.rgb *= 0.95 + 0.10 * cwNoise(vCloudWorld.xz * 0.45 + 11.0);
    ` : '';

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + NOISE_GLSL)
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', /* glsl */ `
        vec4 diffuseColor = vec4( diffuse, opacity );
        {
          ${nuanceBlock}
          // Sombras de nubes en movimiento: dos octavas de noise desplazándose
          vec2 cwUv = vCloudWorld.xz * 0.016 + vec2(uCloudTime * 0.014, uCloudTime * 0.007);
          float cwN = cwNoise(cwUv) * 0.65 + cwNoise(cwUv * 2.6 + 13.0) * 0.35;
          float cwShadow = smoothstep(0.52, 0.80, cwN);
          diffuseColor.rgb *= mix(1.0, 0.70, cwShadow);
        }
      `);
  };
  // Forzar recompilación si el material ya estaba en uso
  material.needsUpdate = true;
}
