import * as THREE from 'three';

/**
 * CameraController
 * -----------------
 * Cámara en tercera persona pensada para pantalla vertical 9:16, con
 * encuadre cinematográfico tipo aventura:
 *  - Baja y cercana al personaje (se ve grande, en el tercio inferior)
 *  - El punto de mira está adelantado y elevado: se ve el horizonte y la
 *    ciudad-acantilado del fondo, no solo el suelo
 *  - Look-ahead lateral: se adelanta suavemente hacia donde corres
 *  - Suavizado exponencial independiente del framerate (sin tirones)
 */
export class CameraController {
  readonly camera: THREE.PerspectiveCamera;

  /** Offset de la cámara respecto al jugador (elevada y con distancia
   *  suficiente para leer mapa, enemigos y saltos). */
  private readonly offset = new THREE.Vector3(0, 7.2, 9.2);
  /** El lookAt apunta por delante: el personaje queda en el tercio
   *  inferior y se ve mucho terreno de juego. */
  private readonly lookAhead = new THREE.Vector3(0, 1.4, -7.5);
  private readonly followLerp = 4.5;  // suavizado de posición
  private readonly lookLerp = 5.5;    // suavizado del punto de mira
  /** Cuánto se adelanta la mirada hacia el movimiento lateral. */
  private readonly lateralLead = 0.55;

  private currentPos = new THREE.Vector3();
  private currentLook = new THREE.Vector3();
  private initialized = false;

  constructor(aspect: number) {
    // FOV generoso para formato vertical: aire arriba, suelo legible abajo
    this.camera = new THREE.PerspectiveCamera(62, aspect, 0.1, 250);
  }

  /** Coloca la cámara instantáneamente (al iniciar o tras un respawn). */
  snapTo(target: THREE.Vector3): void {
    this.currentPos.copy(target).add(this.offset);
    this.currentLook.copy(target).add(this.lookAhead);
    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.currentLook);
    this.initialized = true;
  }

  /**
   * @param velocity velocidad del jugador: desplaza la mirada hacia donde
   *                 corre para que siempre haya espacio por delante.
   */
  update(dt: number, target: THREE.Vector3, velocity?: THREE.Vector3): void {
    if (!this.initialized) {
      this.snapTo(target);
      return;
    }
    const desiredPos = target.clone().add(this.offset);
    const desiredLook = target.clone().add(this.lookAhead);
    if (velocity) {
      // Look-ahead: la cámara "mira" un poco hacia donde te mueves
      desiredLook.x += THREE.MathUtils.clamp(velocity.x * this.lateralLead, -2.2, 2.2);
      desiredLook.z += THREE.MathUtils.clamp(velocity.z * 0.25, -1.5, 1.5);
    }
    // Lerp exponencial independiente del framerate
    this.currentPos.lerp(desiredPos, 1 - Math.exp(-this.followLerp * dt));
    this.currentLook.lerp(desiredLook, 1 - Math.exp(-this.lookLerp * dt));
    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.currentLook);
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
