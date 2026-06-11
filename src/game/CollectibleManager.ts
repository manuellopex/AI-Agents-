import * as THREE from 'three';
import { Effects } from './Effects';

interface Luma {
  position: THREE.Vector3;
  baseY: number;
  phase: number;
  collected: boolean;
  attracted: boolean;
}

/**
 * CollectibleManager
 * -------------------
 * "Lumas": la moneda luminosa de Isla Auria. El LDD pide ~250-360 Lumas en
 * el nivel, así que se renderizan con UN InstancedMesh (una sola draw call)
 * en lugar de cientos de mallas: flotan, rotan, se atraen al jugador
 * (imán) y desaparecen al recogerse, sin coste por unidad.
 */
export class CollectibleManager {
  private lumas: Luma[] = [];
  private instanced: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private effects: Effects;
  private time = 0;

  /** Lumas recogidos en total (estadística). */
  collected = 0;
  /** Lumas disponibles para gastar (moneda). */
  balance = 0;
  onCollect: ((collected: number, total: number) => void) | null = null;

  private readonly levelTotal: number;
  private readonly capacity: number;

  constructor(scene: THREE.Scene, effects: Effects, positions: THREE.Vector3[], hiddenExtra = 0) {
    this.effects = effects;
    this.levelTotal = positions.length + hiddenExtra;
    // Capacidad con margen para drops de enemigos y cajas
    this.capacity = positions.length + hiddenExtra + 80;

    const geo = new THREE.OctahedronGeometry(0.3);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x4de3ff, emissive: 0x18b9e8, emissiveIntensity: 1.0, roughness: 0.3,
    });
    this.instanced = new THREE.InstancedMesh(geo, mat, this.capacity);
    this.instanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.instanced.frustumCulled = false; // se reparten por todo el nivel
    scene.add(this.instanced);

    for (const pos of positions) this.spawnCrystal(pos);
  }

  get total(): number {
    return this.levelTotal;
  }

  spend(amount: number): boolean {
    if (this.balance < amount) return false;
    this.balance -= amount;
    return true;
  }

  /** Crea un Luma (colocado, drop de enemigo o de caja). */
  spawnCrystal(position: THREE.Vector3): void {
    if (this.lumas.length >= this.capacity) return;
    this.lumas.push({
      position: position.clone(),
      baseY: position.y,
      phase: Math.random() * Math.PI * 2,
      collected: false,
      attracted: false,
    });
  }

  /** Anima todos los Lumas y aplica imán + recogida. Una draw call. */
  update(dt: number, playerPosition: THREE.Vector3): void {
    this.time += dt;
    const magnet = playerPosition.clone();
    magnet.y += 0.8;
    const rotY = this.time * 1.5;

    for (let i = 0; i < this.lumas.length; i++) {
      const luma = this.lumas[i];
      if (luma.collected) {
        this.dummy.position.set(0, -100, 0);
        this.dummy.scale.setScalar(0.0001);
      } else {
        const dist = luma.position.distanceTo(magnet);
        if (dist < 2.6) luma.attracted = true;
        if (luma.attracted) {
          const pull = Math.min((12 / Math.max(dist, 0.3)) * dt, 1);
          luma.position.lerp(magnet, pull);
        } else {
          luma.position.y = luma.baseY + Math.sin(this.time * 2 + luma.phase) * 0.15;
        }
        if (dist < 0.95) {
          luma.collected = true;
          this.collected++;
          this.balance++;
          this.effects.burst(luma.position.clone(), 0x4de3ff, 6, 3);
          this.onCollect?.(this.collected, this.levelTotal);
        }
        this.dummy.position.copy(luma.position);
        this.dummy.rotation.set(0, rotY + luma.phase, 0);
        this.dummy.scale.setScalar(1);
      }
      this.dummy.updateMatrix();
      this.instanced.setMatrixAt(i, this.dummy.matrix);
    }
    // Instancias aún no usadas: fuera de vista
    for (let i = this.lumas.length; i < this.capacity; i++) {
      this.dummy.position.set(0, -100, 0);
      this.dummy.scale.setScalar(0.0001);
      this.dummy.updateMatrix();
      this.instanced.setMatrixAt(i, this.dummy.matrix);
    }
    this.instanced.instanceMatrix.needsUpdate = true;
    this.instanced.count = this.capacity;
  }
}
