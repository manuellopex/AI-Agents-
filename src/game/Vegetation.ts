import * as THREE from 'three';
import { applyCloudShadows } from './CloudShadows';

/** Zona elíptica donde sembrar vegetación. */
export interface VegetationZone {
  cx: number;
  cz: number;
  rx: number;
  rz: number;
  count: number;
}

/**
 * Vegetation
 * -----------
 * Hierba y matas instanciadas (una sola draw call para cientos de matas)
 * sembradas sobre el terreno real por raycast. Se mecen suavemente con el
 * viento: el paralaje del follaje al moverse es una de las señales de
 * profundidad 3D más fuertes que existen.
 */
export class Vegetation {
  private grass: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private blades: { pos: THREE.Vector3; rotY: number; scale: number; phase: number }[] = [];
  private time = 0;

  constructor(scene: THREE.Scene, groundMeshes: THREE.Mesh[], zones: VegetationZone[]) {
    const total = zones.reduce((sum, z) => sum + z.count, 0);

    // Mata de hierba: cono fino y alto, con variación de verdes
    const geo = new THREE.ConeGeometry(0.07, 0.5, 5);
    geo.translate(0, 0.25, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
    applyCloudShadows(mat);
    this.grass = new THREE.InstancedMesh(geo, mat, total);
    this.grass.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.grass.frustumCulled = false;

    // Sembrado por raycast: cada mata cae donde realmente hay suelo
    const raycaster = new THREE.Raycaster();
    const down = new THREE.Vector3(0, -1, 0);
    const greens = [new THREE.Color(0x3fae5e), new THREE.Color(0x59c178), new THREE.Color(0x2f9450), new THREE.Color(0x6fcf8a)];
    let placed = 0;
    for (const zone of zones) {
      for (let i = 0; i < zone.count && placed < total; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random());
        const x = zone.cx + Math.cos(a) * r * zone.rx;
        const z = zone.cz + Math.sin(a) * r * zone.rz;
        raycaster.set(new THREE.Vector3(x, 40, z), down);
        raycaster.far = 60;
        const hit = raycaster.intersectObjects(groundMeshes, false)[0];
        if (!hit || hit.point.y < 0.4) continue; // ni en el mar ni en la playa baja
        this.blades.push({
          pos: hit.point.clone(),
          rotY: Math.random() * Math.PI * 2,
          scale: 0.7 + Math.random() * 0.8,
          phase: Math.random() * Math.PI * 2,
        });
        this.grass.setColorAt(placed, greens[placed % greens.length]);
        placed++;
      }
    }
    this.grass.count = this.blades.length;
    if (this.grass.instanceColor) this.grass.instanceColor.needsUpdate = true;
    scene.add(this.grass);
    this.updateMatrices(0);
  }

  private updateMatrices(sway: number): void {
    for (let i = 0; i < this.blades.length; i++) {
      const blade = this.blades[i];
      this.dummy.position.copy(blade.pos);
      this.dummy.rotation.set(
        Math.sin(sway + blade.phase) * 0.12,
        blade.rotY,
        Math.cos(sway * 0.8 + blade.phase) * 0.12,
      );
      this.dummy.scale.setScalar(blade.scale);
      this.dummy.updateMatrix();
      this.grass.setMatrixAt(i, this.dummy.matrix);
    }
    this.grass.instanceMatrix.needsUpdate = true;
  }

  update(dt: number): void {
    this.time += dt;
    // El viento mece la hierba (actualización barata: solo rotaciones)
    this.updateMatrices(this.time * 1.6);
  }
}
