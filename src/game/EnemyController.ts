import * as THREE from 'three';
import { Effects } from './Effects';
import type { EnemyDef } from './LevelManager';

/**
 * EnemyController
 * ----------------
 * "Grubs": criaturas originales de Isla Auria — blobs morados con ojos
 * enormes y un brote en la cabeza que patrullan entre dos puntos. Dañan al
 * jugador por contacto y son derrotadas por el ataque giratorio o el golpe.
 */
class Grub {
  readonly group = new THREE.Group();
  alive = true;
  /** Radio de contacto que daña al jugador. */
  readonly touchRadius = 1.0;

  private pointA: THREE.Vector3;
  private pointB: THREE.Vector3;
  private t = Math.random();
  private direction = 1;
  private readonly speed = 0.25; // fracción del recorrido por segundo
  private time = Math.random() * 10;
  private dyingTimer = 0;

  constructor(def: EnemyDef) {
    this.pointA = def.pointA.clone();
    this.pointB = def.pointB.clone();

    // Cuerpo: esfera achatada low-poly
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xb25bd6 });
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 2), bodyMat);
    body.scale.set(1, 0.8, 1);
    body.position.y = 0.45;
    body.castShadow = true;
    this.group.add(body);

    // Ojos grandes (carácter amistosamente amenazante)
    const eyeGeo = new THREE.SphereGeometry(0.13, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xfff6d8 });
    const pupilGeo = new THREE.SphereGeometry(0.06, 6, 6);
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(0.2 * side, 0.55, 0.42);
      const pupil = new THREE.Mesh(pupilGeo, pupilMat);
      pupil.position.z = 0.1;
      eye.add(pupil);
      this.group.add(eye);
    }

    // Pequeños "brotes" en la cabeza
    const sprout = new THREE.Mesh(
      new THREE.ConeGeometry(0.1, 0.35, 5),
      new THREE.MeshStandardMaterial({ color: 0x3fae6a }),
    );
    sprout.position.y = 0.95;
    this.group.add(sprout);

    this.group.position.copy(this.pointA);
  }

  get position(): THREE.Vector3 {
    return this.group.position;
  }

  update(dt: number): void {
    if (!this.alive) {
      // Animación de muerte: encoger hasta desaparecer
      this.dyingTimer -= dt;
      const s = Math.max(this.dyingTimer / 0.3, 0.0001);
      this.group.scale.setScalar(s);
      if (this.dyingTimer <= 0) this.group.visible = false;
      return;
    }
    this.time += dt;
    // Patrulla de ida y vuelta entre A y B
    this.t += this.direction * this.speed * dt;
    if (this.t >= 1) { this.t = 1; this.direction = -1; }
    if (this.t <= 0) { this.t = 0; this.direction = 1; }
    const prev = this.group.position.clone();
    this.group.position.lerpVectors(this.pointA, this.pointB, this.t);
    // Rebote al caminar
    this.group.position.y += Math.abs(Math.sin(this.time * 6)) * 0.12;
    // Mirar hacia donde se mueve
    const dir = this.group.position.clone().sub(prev);
    if (dir.lengthSq() > 1e-6) {
      this.group.rotation.y = Math.atan2(dir.x, dir.z);
    }
  }

  kill(): void {
    this.alive = false;
    this.dyingTimer = 0.3;
  }
}

export class EnemyController {
  private enemies: Grub[] = [];
  private effects: Effects;

  /** Llamado cuando un enemigo toca al jugador. */
  onPlayerHit: ((enemyPosition: THREE.Vector3) => void) | null = null;
  /** Llamado cuando un enemigo es derrotado (con su posición: suelta Lumas). */
  onEnemyDefeated: ((position: THREE.Vector3) => void) | null = null;
  /** Llamado cuando el jugador aplasta a un enemigo cayendo encima. */
  onStomped: (() => void) | null = null;

  private scene: THREE.Scene;

  constructor(scene: THREE.Scene, effects: Effects, defs: EnemyDef[]) {
    this.scene = scene;
    this.effects = effects;
    for (const def of defs) this.spawn(def);
  }

  /** Añade un enemigo en runtime (oleadas del Santuario del Desafío). */
  spawn(def: EnemyDef): void {
    const enemy = new Grub(def);
    this.enemies.push(enemy);
    this.scene.add(enemy.group);
    this.effects.burst(def.pointA.clone().add(new THREE.Vector3(0, 0.6, 0)), 0xb25bd6, 10, 3);
  }

  /** Enemigos vivos actualmente (las oleadas esperan a que llegue a 0). */
  get aliveCount(): number {
    return this.enemies.filter((e) => e.alive).length;
  }

  update(dt: number, playerPosition: THREE.Vector3, playerVelocityY = 0): void {
    for (const enemy of this.enemies) {
      enemy.update(dt);
      if (!enemy.alive) continue;
      const dx = enemy.position.x - playerPosition.x;
      const dz = enemy.position.z - playerPosition.z;
      const dy = playerPosition.y - enemy.position.y;
      const horizontalSq = dx * dx + dz * dz;

      // Salto sobre el enemigo: si Mael cae encima, lo aplasta y rebota
      if (playerVelocityY < -2 && dy > 0.3 && dy < 1.8 && horizontalSq < 1.4) {
        enemy.kill();
        this.effects.burst(enemy.position.clone().add(new THREE.Vector3(0, 0.5, 0)), 0xb25bd6, 12, 4);
        this.onEnemyDefeated?.(enemy.position.clone());
        this.onStomped?.();
        continue;
      }
      // Contacto lateral: daña al jugador
      if (horizontalSq < enemy.touchRadius * enemy.touchRadius && Math.abs(dy) < 1.4) {
        this.onPlayerHit?.(enemy.position.clone());
      }
    }
  }

  /** El ataque de giro derrota a los enemigos dentro del radio. */
  attackAt(center: THREE.Vector3, radius: number): number {
    let defeated = 0;
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const dx = enemy.position.x - center.x;
      const dz = enemy.position.z - center.z;
      const dy = enemy.position.y - center.y;
      if (dx * dx + dz * dz < radius * radius && Math.abs(dy) < 1.6) {
        enemy.kill();
        this.effects.burst(enemy.position.clone().add(new THREE.Vector3(0, 0.5, 0)), 0xb25bd6, 12, 4);
        this.onEnemyDefeated?.(enemy.position.clone());
        defeated++;
      }
    }
    return defeated;
  }
}
