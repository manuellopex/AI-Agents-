import * as THREE from 'three';

/**
 * CameraController
 * -----------------
 * Cámara de seguimiento en tercera persona para vertical 9:16:
 *  - Gira suavemente para colocarse DETRÁS de Mael según hacia dónde
 *    corre: los enemigos y el camino siempre quedan delante, en pantalla.
 *  - Elevada y con distancia para leer plataformas y patrullas.
 *  - Look-ahead hacia el movimiento y suavizado independiente del framerate.
 *
 * El yaw actual se expone para que el joystick sea relativo a cámara.
 */
export class CameraController {
  readonly camera: THREE.PerspectiveCamera;

  /** Ángulo horizontal actual de la cámara (0 = mirando hacia -Z). */
  yaw = 0;
  /** Geometría que la cámara no debe atravesar (la asigna el GameManager). */
  colliders: THREE.Object3D[] = [];
  private occluderRay = new THREE.Raycaster();

  /** Altura y distancia respecto al jugador. */
  private readonly height = 8.6;
  private readonly distance = 11.5;
  /** El punto de mira: adelantado y bajo, jugador en el tercio inferior. */
  private readonly lookAheadDist = 9.0;
  private readonly lookAheadY = 1.4;
  private readonly followLerp = 4.5;
  private readonly lookLerp = 5.5;
  /** Velocidad de giro del yaw hacia la espalda del jugador. */
  private readonly yawLerp = 1.7;
  private readonly lateralLead = 0.5;

  private currentPos = new THREE.Vector3();
  private currentLook = new THREE.Vector3();
  private initialized = false;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(62, aspect, 0.1, 800);
  }

  /** Coloca la cámara instantáneamente (inicio o respawn). */
  snapTo(target: THREE.Vector3): void {
    this.currentPos.copy(target).add(this.offsetVector());
    this.currentLook.copy(target).add(this.lookVector());
    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.currentLook);
    this.initialized = true;
  }

  private offsetVector(): THREE.Vector3 {
    return new THREE.Vector3(Math.sin(this.yaw) * this.distance, this.height, Math.cos(this.yaw) * this.distance);
  }

  private lookVector(): THREE.Vector3 {
    return new THREE.Vector3(
      -Math.sin(this.yaw) * this.lookAheadDist, this.lookAheadY, -Math.cos(this.yaw) * this.lookAheadDist,
    );
  }

  update(dt: number, target: THREE.Vector3, velocity?: THREE.Vector3): void {
    if (!this.initialized) {
      this.snapTo(target);
      return;
    }

    // Girar el yaw para quedar detrás de la dirección de carrera
    if (velocity) {
      const speed = Math.hypot(velocity.x, velocity.z);
      if (speed > 1.6) {
        const desiredYaw = Math.atan2(velocity.x, velocity.z) + Math.PI;
        let delta = desiredYaw - this.yaw;
        delta = Math.atan2(Math.sin(delta), Math.cos(delta));
        // Gira más rápido cuanto más corre (y nunca de golpe)
        this.yaw += delta * Math.min(this.yawLerp * (0.4 + (speed / 7) * 0.6) * dt, 1);
      }
    }

    const desiredPos = target.clone().add(this.offsetVector());
    const desiredLook = target.clone().add(this.lookVector());
    if (velocity) {
      // Look-ahead en ejes de cámara: derecha y profundidad
      const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      const vRight = velocity.x * right.x + velocity.z * right.z;
      const vFwd = velocity.x * fwd.x + velocity.z * fwd.z;
      desiredLook.addScaledVector(right, THREE.MathUtils.clamp(vRight * this.lateralLead, -2.2, 2.2));
      desiredLook.addScaledVector(fwd, THREE.MathUtils.clamp(vFwd * 0.22, -1.5, 1.5));
    }

    this.currentPos.lerp(desiredPos, 1 - Math.exp(-this.followLerp * dt));
    this.currentLook.lerp(desiredLook, 1 - Math.exp(-this.lookLerp * dt));

    // Oclusión: si un muro/acantilado se interpone, acercar la cámara
    let camPos = this.currentPos;
    if (this.colliders.length > 0) {
      const eye = target.clone().add(new THREE.Vector3(0, 1.6, 0));
      const toCam = this.currentPos.clone().sub(eye);
      const dist = toCam.length();
      this.occluderRay.set(eye, toCam.normalize());
      this.occluderRay.far = dist;
      const hit = this.occluderRay.intersectObjects(this.colliders, false)[0];
      if (hit && hit.distance < dist - 0.5) {
        camPos = eye.clone().addScaledVector(toCam, Math.max(hit.distance - 0.6, 1.5));
      }
    }
    this.camera.position.copy(camPos);
    this.camera.lookAt(this.currentLook);

    // FOV dinámico (LDD): 62 quieto → 70 a toda velocidad (sensación de carrera)
    if (velocity) {
      const speedT = THREE.MathUtils.clamp(Math.hypot(velocity.x, velocity.z) / 7, 0, 1);
      const targetFov = 62 + speedT * 8;
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(3 * dt, 1);
      this.camera.updateProjectionMatrix();
    }
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
