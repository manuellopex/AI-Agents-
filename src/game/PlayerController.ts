import * as THREE from 'three';
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
  readonly attackRadius = 2.2;
  /** true durante la ventana activa del ataque. */
  attacking = false;

  onJump: ((isDouble: boolean) => void) | null = null;
  onAttack: ((center: THREE.Vector3, radius: number, kind: AttackKind) => void) | null = null;
  onFellOffMap: (() => void) | null = null;
  /** Rebote en trampolín. */
  onBouncePad: (() => void) | null = null;

  /** Trampolines del nivel (los inyecta el GameManager). */
  pads: { position: THREE.Vector3; power: number }[] = [];
  /** true mientras cae en ground pound (golpea al aterrizar). */
  pounding = false;

  // --- Parámetros de movimiento (ajustables) ---
  private readonly walkSpeed = 3.5;
  private readonly runSpeed = 7;
  private readonly gravity = 28;
  private readonly jumpVelocity = 11;
  private readonly doubleJumpVelocity = 10;
  private readonly maxStepHeight = 0.55;
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
  private bodyGroup = new THREE.Group();
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

  /** Mael: personaje original low-poly (traje teal, pelo castaño oscuro, bufanda dorada). */
  private buildCharacter(): void {
    const skin = new THREE.MeshStandardMaterial({ color: 0xf0b98a, flatShading: true });
    const suit = new THREE.MeshStandardMaterial({ color: 0x2aa6a0, flatShading: true });
    const hair = new THREE.MeshStandardMaterial({ color: 0x4a3326, flatShading: true });
    const scarf = new THREE.MeshStandardMaterial({ color: 0xf2c14e, flatShading: true });

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.5, 4, 8), suit);
    body.position.y = 0.7;
    body.castShadow = true;
    this.bodyGroup.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), skin);
    head.position.y = 1.45;
    head.castShadow = true;
    this.bodyGroup.add(head);

    // Cresta de pelo hacia atrás
    const crest = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 6), hair);
    crest.position.set(0, 1.68, -0.12);
    crest.rotation.x = -0.7;
    this.bodyGroup.add(crest);

    // Ojos
    const eyeGeo = new THREE.SphereGeometry(0.055, 6, 6);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1b2a33 });
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(0.12 * side, 1.48, 0.28);
      this.bodyGroup.add(eye);
    }

    // Bufanda (da lectura de dirección al girar)
    const scarfMesh = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.09, 6, 10), scarf);
    scarfMesh.position.y = 1.18;
    scarfMesh.rotation.x = Math.PI / 2;
    this.bodyGroup.add(scarfMesh);

    this.group.add(this.bodyGroup);
  }

  get position(): THREE.Vector3 {
    return this.group.position;
  }

  /** Ángulo hacia el que mira Mael (lo usa Oryn para colocarse en su hombro). */
  get facingY(): number {
    return this.bodyGroup.rotation.y;
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
    this.updateAttack(dt);
    this.updateCheckpoints();
    this.updateVisuals(dt);

    // Caída fuera del mapa
    if (this.group.position.y < this.killY) {
      this.onFellOffMap?.();
    }
  }

  private updateMovement(dt: number): void {
    const ix = this.input.moveX;
    const iz = this.input.moveZ;
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

    this.grounded = false;
    if (hits.length > 0) {
      const groundY = hits[0].point.y;
      const feet = this.group.position.y;
      if (this.velocity.y <= 0 && feet <= groundY + 0.05 && prevY >= groundY - this.maxStepHeight) {
        // Aterrizaje / caminando sobre el suelo
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
      } else if (this.grounded === false && feet < groundY - this.maxStepHeight && this.velocity.y <= 0 && prevY < groundY) {
        // Estamos contra la pared lateral de una plataforma más alta:
        // deshacer movimiento horizontal para no atravesarla.
        this.group.position.x -= this.velocity.x * dt;
        this.group.position.z -= this.velocity.z * dt;
      }
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
    if (this.input.consumeAttack() && this.attackCooldown <= 0 && !this.attacking) {
      // Ground pound: ataque en el aire = caída en picado con golpe de área
      if (!this.grounded && !this.pounding) {
        this.pounding = true;
        this.velocity.set(this.velocity.x * 0.2, -26, this.velocity.z * 0.2);
        this.attackCooldown = 0.6;
        return;
      }
      const speed = Math.hypot(this.velocity.x, this.velocity.z);
      this.attacking = true;
      this.attackCooldown = 1.0; // cooldown breve
      if (speed > 4) {
        // Golpe hacia adelante: embestida corta en la dirección de la carrera
        this.currentAttack = 'punch';
        this.attackTimer = 0.25;
        const dir = new THREE.Vector3(Math.sin(this.bodyGroup.rotation.y), 0, Math.cos(this.bodyGroup.rotation.y));
        this.velocity.x = dir.x * 12;
        this.velocity.z = dir.z * 12;
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
    // Pequeño rebote al correr (estilo arcade)
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    if (this.grounded && speed > 0.5) {
      this.bodyGroup.position.y = Math.abs(Math.sin(this.runTime * 2.5)) * 0.08;
    } else {
      this.bodyGroup.position.y = 0;
    }
    // Estirar ligeramente el cuerpo en el aire
    const stretch = this.grounded ? 1 : 1 + Math.min(Math.abs(this.velocity.y) * 0.012, 0.15);
    this.bodyGroup.scale.y = stretch;
  }
}
