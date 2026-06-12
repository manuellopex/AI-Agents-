import * as THREE from 'three';
import { MaelCharacter } from './MaelCharacter';
import type { MobileInputController } from './MobileInputController';
import type { Obstacle } from './LevelManager';

/** Tipo de ataque ejecutado (informa al GameManager para el feedback). */
export type AttackKind = 'spin' | 'punch' | 'pound';

/**
 * PlayerController
 * -----------------
 * Mael Veyra, el joven aventurero protagonista: movimiento arcade (caminar/correr
 * según la inclinación del joystick), salto, doble salto, ataque giratorio,
 * golpe hacia adelante (si atacas mientras corres), daño con parpadeo y
 * respawn en el último checkpoint (RespawnSystem integrado).
 *
 * Física simple y estable: gravedad + raycast hacia abajo para detectar el
 * suelo (funciona en plataformas, puentes y rampas) y colisión cilíndrica
 * contra obstáculos (árboles, rocas, cajas, ruinas).
 */
export class PlayerController {
  readonly group = new THREE.Group();
  readonly velocity = new THREE.Vector3();
  grounded = false;

  /** Radio del ataque de giro. */
  readonly attackRadius = 2.4;
  /** true durante la ventana activa del ataque. */
  attacking = false;

  onJump: ((isDouble: boolean) => void) | null = null;
  onAttack: ((center: THREE.Vector3, radius: number, kind: AttackKind) => void) | null = null;
  onFellOffMap: (() => void) | null = null;
  /** Rebote en trampolín. */
  onBouncePad: (() => void) | null = null;

  /** Trampolines del nivel (los inyecta el GameManager). */
  pads: { position: THREE.Vector3; power: number }[] = [];
  /** Corrientes de viento ascendentes: {x, z, radio, topY, empuje}. */
  updrafts: { x: number; z: number; r: number; topY: number; lift: number }[] = [];
  /** Muros reales: cajas orientadas (edificios, murallas, cueva). */
  boxColliders: { cx: number; cz: number; hx: number; hz: number; rotY: number; y0: number; y1: number }[] = [];
  /** Acantilados de las mesas: paredes elípticas infranqueables. */
  ellipseColliders: { cx: number; cz: number; rx: number; rz: number; y1: number }[] = [];
  /** Yaw de la cámara: el joystick se interpreta relativo a ella. */
  cameraYaw = 0;
  /** true mientras cae en ground pound (golpea al aterrizar). */
  pounding = false;

  // --- Métricas de gameplay (spec de escala clásica, 1 unidad = 1 m) ---
  private readonly walkSpeed = 3.5;       // caminar 3.5 m/s
  private readonly runSpeed = 6.2;        // correr 6.2 m/s
  private readonly gravity = 28;
  private readonly jumpVelocity = 9.5;    // altura de salto ≈ 1.6 m
  private readonly doubleJumpVelocity = 9.5; // total con doble ≈ 3.2 m
  private readonly maxStepHeight = 0.6;   // escalones y pendientes
  private readonly mantleHeight = 1.25;   // ledge assist hasta 1.2 m
  private readonly playerRadius = 0.45;

  private input: MobileInputController;
  private groundMeshes: THREE.Mesh[];
  private obstacles: Obstacle[];
  private killY: number;

  private canDoubleJump = false;
  private coyoteTimer = 0; // pequeño margen para saltar tras dejar el borde
  private currentAttack: AttackKind = 'spin';
  private attackTimer = 0;
  private attackCooldown = 0;
  private blinkTimer = 0;
  private respawnPoint = new THREE.Vector3(0, 1, 2);
  private checkpoints: THREE.Vector3[];

  private raycaster = new THREE.Raycaster();
  private readonly down = new THREE.Vector3(0, -1, 0);
  private character = new MaelCharacter();
  private bodyGroup = this.character.root;
  private runTime = 0;

  constructor(
    scene: THREE.Scene,
    input: MobileInputController,
    groundMeshes: THREE.Mesh[],
    obstacles: Obstacle[],
    checkpoints: THREE.Vector3[],
    killY: number,
  ) {
    this.input = input;
    this.groundMeshes = groundMeshes;
    this.obstacles = obstacles;
    this.checkpoints = checkpoints;
    this.killY = killY;
    if (checkpoints.length > 0) this.respawnPoint.copy(checkpoints[0]);

    this.buildCharacter();
    this.group.position.copy(this.respawnPoint);
    scene.add(this.group);
  }

  /** Monta el modelo de Mael (ver MaelCharacter.ts, fiel a la hoja de personaje). */
  private buildCharacter(): void {
    this.group.add(this.bodyGroup);
  }

  /** Mantiene la animación de idle (cutscenes): respira en vez de congelarse. */
  updateIdleVisuals(dt: number): void {
    this.character.update(dt, {
      speed: 0, grounded: true, velocityY: 0,
      attacking: false, attackKind: 'spin', pounding: false,
    });
  }

  /** Enchufa el modelo final GLB (lo llama el GameManager si existe). */
  useGltfModel(model: import('three').Group, clips: import('three').AnimationClip[]): void {
    this.character.useGltf(model, clips);
  }

  get position(): THREE.Vector3 {
    return this.group.position;
  }

  /** Ángulo hacia el que mira Mael (lo usa Oryn para colocarse en su hombro). */
  get facingY(): number {
    return this.bodyGroup.rotation.y;
  }

  /** Tipo del ataque en curso (válido mientras attacking === true). */
  get activeAttackKind(): AttackKind {
    return this.currentAttack;
  }

  /**
   * Hitboxes del ataque en curso (siguen al jugador cada frame).
   * El golpe hacia adelante incluye además una burbuja alrededor del
   * cuerpo: los enemigos que entren de lado también reciben el golpe.
   */
  getAttackHitboxes(): { center: THREE.Vector3; radius: number }[] {
    if (this.currentAttack === 'punch') {
      const dir = new THREE.Vector3(Math.sin(this.bodyGroup.rotation.y), 0, Math.cos(this.bodyGroup.rotation.y));
      return [
        { center: this.group.position.clone().addScaledVector(dir, 1.2), radius: 1.6 },
        { center: this.group.position.clone(), radius: 1.7 },
      ];
    }
    return [{ center: this.group.position.clone(), radius: this.attackRadius }];
  }

  /** Inicia el daño visual + retroceso. Lo invoca el GameManager. */
  applyHit(fromPosition: THREE.Vector3): void {
    this.blinkTimer = 1.5;
    const knock = this.group.position.clone().sub(fromPosition).setY(0);
    if (knock.lengthSq() < 1e-4) knock.set(0, 0, 1);
    knock.normalize().multiplyScalar(6);
    this.velocity.x = knock.x;
    this.velocity.z = knock.z;
    this.velocity.y = 5;
    this.grounded = false;
  }

  respawn(): void {
    this.group.position.copy(this.respawnPoint).add(new THREE.Vector3(0, 0.5, 0));
    this.velocity.set(0, 0, 0);
    this.blinkTimer = 1.5;
  }

  resetToStart(): void {
    this.respawnPoint.copy(this.checkpoints[0]);
    this.respawn();
    this.blinkTimer = 0;
    this.bodyGroup.visible = true;
  }

  update(dt: number): void {
    this.input.update();
    this.updateMovement(dt);
    this.updateJump(dt);
    this.applyPhysics(dt);
    this.resolveObstacles();
    this.resolveBoxes();
    this.resolveEllipses();
    this.updateAttack(dt);
    this.updateCheckpoints();
    this.updateVisuals(dt);

    // Caída fuera del mapa
    if (this.group.position.y < this.killY) {
      this.onFellOffMap?.();
    }
  }

  private updateMovement(dt: number): void {
    // Entrada relativa a cámara: "arriba" siempre es alejarse de la cámara
    const cos = Math.cos(this.cameraYaw);
    const sin = Math.sin(this.cameraYaw);
    const rawX = this.input.moveX;
    const rawZ = this.input.moveZ;
    const ix = rawX * cos + rawZ * sin;
    const iz = -rawX * sin + rawZ * cos;
    const magnitude = Math.min(Math.hypot(ix, iz), 1);
    // Joystick a fondo = correr; inclinación suave = caminar
    const speed = magnitude > 0.7 ? this.runSpeed : this.walkSpeed;
    const targetX = magnitude > 0.05 ? (ix / (magnitude || 1)) * speed * magnitude : 0;
    const targetZ = magnitude > 0.05 ? (iz / (magnitude || 1)) * speed * magnitude : 0;

    // Aceleración suave para que se sienta responsivo pero no robótico
    const accel = this.grounded ? 14 : 8;
    this.velocity.x += (targetX - this.velocity.x) * Math.min(accel * dt, 1);
    this.velocity.z += (targetZ - this.velocity.z) * Math.min(accel * dt, 1);

    // Rotar el personaje hacia la dirección de movimiento
    if (magnitude > 0.1) {
      const targetAngle = Math.atan2(this.velocity.x, this.velocity.z);
      let delta = targetAngle - this.bodyGroup.rotation.y;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      this.bodyGroup.rotation.y += delta * Math.min(12 * dt, 1);
      this.runTime += dt * Math.hypot(this.velocity.x, this.velocity.z);
    }
  }

  private updateJump(dt: number): void {
    this.coyoteTimer = this.grounded ? 0.12 : Math.max(this.coyoteTimer - dt, 0);
    if (this.input.consumeJump()) {
      if (this.grounded || this.coyoteTimer > 0) {
        this.velocity.y = this.jumpVelocity;
        this.grounded = false;
        this.coyoteTimer = 0;
        this.canDoubleJump = true;
        this.onJump?.(false);
      } else if (this.canDoubleJump) {
        this.velocity.y = this.doubleJumpVelocity;
        this.canDoubleJump = false;
        this.onJump?.(true);
      }
    }
  }

  private applyPhysics(dt: number): void {
    this.velocity.y -= this.gravity * dt;
    // Corrientes de viento: elevan mientras estés dentro de la columna
    for (const u of this.updrafts) {
      const dx = this.group.position.x - u.x;
      const dz = this.group.position.z - u.z;
      if (dx * dx + dz * dz < u.r * u.r && this.group.position.y < u.topY) {
        this.velocity.y = Math.min(this.velocity.y + u.lift * dt, 9);
      }
    }
    const prevY = this.group.position.y;
    this.group.position.x += this.velocity.x * dt;
    this.group.position.z += this.velocity.z * dt;
    this.group.position.y += this.velocity.y * dt;

    // Raycast hacia abajo para encontrar el suelo
    const origin = this.group.position.clone();
    origin.y += 2;
    this.raycaster.set(origin, this.down);
    this.raycaster.far = 30;
    const hits = this.raycaster.intersectObjects(this.groundMeshes, false);

    const wasGrounded = this.grounded;
    this.grounded = false;
    if (hits.length > 0) {
      const groundY = hits[0].point.y;
      const feet = this.group.position.y;
      // Aterrizaje robusto (sin tunneling a baja tasa de frames):
      //  - crossedPlane: los pies estaban por encima del suelo el frame
      //    anterior y ahora por debajo → aterriza aunque la caída haya
      //    avanzado más de un escalón en un solo frame (ground pound, lag)
      //  - stick: ya estaba en el suelo → sigue pegado en pendientes y
      //    escalones de hasta maxStepHeight
      const crossedPlane = prevY >= groundY - 0.001 && feet <= groundY + 0.05;
      const stick = wasGrounded && Math.abs(groundY - feet) <= this.maxStepHeight;
      if (this.velocity.y <= 0 && (crossedPlane || stick)) {
        this.group.position.y = groundY;
        this.velocity.y = 0;
        this.grounded = true;
        this.canDoubleJump = false;
        // Impacto del ground pound: golpe de área al tocar suelo
        if (this.pounding) {
          this.pounding = false;
          this.onAttack?.(this.group.position.clone(), 2.6, 'pound');
        }
        // Trampolines: lanzan hacia arriba al pisarlos
        for (const pad of this.pads) {
          const dx = this.group.position.x - pad.position.x;
          const dz = this.group.position.z - pad.position.z;
          if (dx * dx + dz * dz < 1.1 && Math.abs(this.group.position.y - pad.position.y) < 0.8) {
            this.velocity.y = pad.power;
            this.grounded = false;
            this.canDoubleJump = true;
            this.onBouncePad?.();
            break;
          }
        }
      } else if (wasGrounded && feet < groundY - this.maxStepHeight && this.velocity.y <= 0 && prevY < groundY) {
        const ledge = groundY - feet;
        if (ledge <= this.mantleHeight) {
          // Ledge assist: bordillos de hasta 1.2 m se montan con un impulso
          this.velocity.y = Math.sqrt(2 * this.gravity * (ledge + 0.25));
          this.grounded = false;
        } else {
          // Pared real: deshacer el movimiento horizontal
          this.group.position.x -= this.velocity.x * dt;
          this.group.position.z -= this.velocity.z * dt;
        }
      }
    }
  }

  /** Colisión contra muros reales: cajas orientadas (XZ). */
  private resolveBoxes(): void {
    const p = this.group.position;
    for (const b of this.boxColliders) {
      if (p.y < b.y0 || p.y > b.y1) continue;
      // A espacio local de la caja
      const cos = Math.cos(-b.rotY);
      const sin = Math.sin(-b.rotY);
      const dx = p.x - b.cx;
      const dz = p.z - b.cz;
      const lx = dx * cos - dz * sin;
      const lz = dx * sin + dz * cos;
      const ox = b.hx + this.playerRadius - Math.abs(lx);
      const oz = b.hz + this.playerRadius - Math.abs(lz);
      if (ox <= 0 || oz <= 0) continue; // fuera
      // Empujar por el eje de menor penetración
      let px = 0, pz = 0;
      if (ox < oz) px = ox * Math.sign(lx || 1);
      else pz = oz * Math.sign(lz || 1);
      const wc = Math.cos(b.rotY);
      const ws = Math.sin(b.rotY);
      p.x += px * wc - pz * ws;
      p.z += px * ws + pz * wc;
    }
  }

  /** Acantilados de mesa: pared elíptica sólida hasta cerca del borde. */
  private resolveEllipses(): void {
    const p = this.group.position;
    for (const e of this.ellipseColliders) {
      if (p.y > e.y1) continue; // por encima del muro (rampa coronando, cima)
      const nx = (p.x - e.cx) / (e.rx + this.playerRadius);
      const nz = (p.z - e.cz) / (e.rz + this.playerRadius);
      const d = Math.hypot(nx, nz);
      if (d >= 1 || d < 1e-4) continue; // fuera de la mesa, o centro exacto
      const scale = 1 / d;
      p.x = e.cx + nx * scale * (e.rx + this.playerRadius);
      p.z = e.cz + nz * scale * (e.rz + this.playerRadius);
    }
  }

  /** Empuje cilíndrico contra árboles, rocas y cajas. */
  private resolveObstacles(): void {
    for (const ob of this.obstacles) {
      const dx = this.group.position.x - ob.position.x;
      const dz = this.group.position.z - ob.position.z;
      const dy = this.group.position.y - ob.position.y;
      if (dy < -0.5 || dy > 2) continue; // alturas distintas, ignorar
      const minDist = ob.radius + this.playerRadius;
      const distSq = dx * dx + dz * dz;
      if (distSq < minDist * minDist && distSq > 1e-6) {
        const dist = Math.sqrt(distSq);
        const push = (minDist - dist) / dist;
        this.group.position.x += dx * push;
        this.group.position.z += dz * push;
      }
    }
  }

  private updateAttack(dt: number): void {
    this.attackCooldown = Math.max(this.attackCooldown - dt, 0);
    // Orden importante: el botón solo se consume cuando el ataque puede
    // dispararse → pulsar durante el cooldown queda en buffer y sale solo
    if (this.attackCooldown <= 0 && !this.attacking && this.input.consumeAttack()) {
      // Ground pound: ataque en el aire = caída en picado con golpe de área
      if (!this.grounded && !this.pounding) {
        this.pounding = true;
        this.velocity.set(this.velocity.x * 0.2, -26, this.velocity.z * 0.2);
        this.attackCooldown = 0.5;
        return;
      }
      const speed = Math.hypot(this.velocity.x, this.velocity.z);
      this.attacking = true;
      this.attackCooldown = 0.55; // cooldown corto: combate ágil
      if (speed > 4) {
        // Golpe hacia adelante: embestida corta en la dirección de la carrera
        this.currentAttack = 'punch';
        this.attackTimer = 0.32;
        const dir = new THREE.Vector3(Math.sin(this.bodyGroup.rotation.y), 0, Math.cos(this.bodyGroup.rotation.y));
        this.velocity.x = dir.x * 12.5;
        this.velocity.z = dir.z * 12.5;
        const hitCenter = this.group.position.clone().addScaledVector(dir, 1.3);
        this.onAttack?.(hitCenter, 1.3, 'punch');
      } else {
        // Ataque giratorio: golpea todo alrededor
        this.currentAttack = 'spin';
        this.attackTimer = 0.4;
        this.onAttack?.(this.group.position.clone(), this.attackRadius, 'spin');
      }
    }
    if (this.attacking) {
      this.attackTimer -= dt;
      if (this.currentAttack === 'spin') {
        // Giro rápido del cuerpo como feedback del ataque
        this.bodyGroup.rotation.y += dt * 25;
      } else {
        // Inclinación hacia adelante durante el golpe
        this.bodyGroup.rotation.x = -0.45;
      }
      if (this.attackTimer <= 0) {
        this.attacking = false;
        this.bodyGroup.rotation.x = 0;
      }
    }
  }

  /** Actualiza el punto de respawn al pisar cerca de un checkpoint. */
  private updateCheckpoints(): void {
    if (!this.grounded) return;
    for (const cp of this.checkpoints) {
      const dx = cp.x - this.group.position.x;
      const dz = cp.z - this.group.position.z;
      if (dx * dx + dz * dz < 36) {
        this.respawnPoint.copy(cp);
      }
    }
  }

  private updateVisuals(dt: number): void {
    // Parpadeo durante la invulnerabilidad
    if (this.blinkTimer > 0) {
      this.blinkTimer -= dt;
      this.bodyGroup.visible = Math.floor(this.blinkTimer * 10) % 2 === 0;
      if (this.blinkTimer <= 0) this.bodyGroup.visible = true;
    }
    // Animación procedural por extremidades (carrera, salto, ataques…)
    this.character.update(dt, {
      speed: Math.hypot(this.velocity.x, this.velocity.z),
      grounded: this.grounded,
      velocityY: this.velocity.y,
      attacking: this.attacking,
      attackKind: this.currentAttack,
      pounding: this.pounding,
    });
  }
}
