import * as THREE from 'three';
import { AudioManager } from './AudioManager';
import { CameraController } from './CameraController';
import { CollectibleManager } from './CollectibleManager';
import { CompanionOryn } from './CompanionOryn';
import { Effects } from './Effects';
import { EnemyController } from './EnemyController';
import { GoalPortal } from './GoalPortal';
import { HealthSystem } from './HealthSystem';
import { LevelManager } from './LevelManager';
import { Liora } from './Liora';
import { MobileInputController } from './MobileInputController';
import { PlayerController } from './PlayerController';
import { UIManager } from './UIManager';

type GameState = 'ready' | 'playing' | 'paused' | 'victory' | 'defeat';

/**
 * GameManager
 * ------------
 * Punto de entrada y orquestador del juego: crea el renderer, la escena,
 * todos los sistemas, conecta los eventos entre módulos (jugador ↔ enemigos
 * ↔ vida ↔ UI ↔ audio) y ejecuta el bucle principal. También maneja los
 * estados: inicio, jugando, pausa, victoria y derrota.
 */
export class GameManager {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private state: GameState = 'ready';
  private rafId = 0;
  private clock = new THREE.Clock();

  // Sistemas persistentes (viven entre reinicios)
  private input: MobileInputController;
  private ui: UIManager;
  private audio = new AudioManager();

  // Mundo (se reconstruye al reiniciar)
  private scene!: THREE.Scene;
  private cameraCtrl!: CameraController;
  private level!: LevelManager;
  private player!: PlayerController;
  private oryn!: CompanionOryn;
  private liora!: Liora;
  private enemies!: EnemyController;
  private collectibles!: CollectibleManager;
  private goal!: GoalPortal;
  private effects!: Effects;
  private health = new HealthSystem();

  // Flags narrativos: cada momento de la historia ocurre una sola vez
  private storyFlags = { firstLuma: false, firstKill: false, reward: false, nearGoal: false };
  private introTimers: ReturnType<typeof setTimeout>[] = [];
  /** Cuenta atrás para el próximo canto ambiental de un Quirí. */
  private quiriTimer = 5;

  constructor(container: HTMLElement) {
    this.container = container;
    container.style.position = 'relative';
    container.style.overflow = 'hidden';
    container.style.touchAction = 'none';

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.cssText = 'position:absolute;inset:0;display:block;';
    container.appendChild(this.renderer.domElement);

    this.input = new MobileInputController(container);
    this.ui = new UIManager(container);
    this.wireUi();

    this.buildWorld();
    this.handleResize();
    window.addEventListener('resize', this.handleResize);

    this.ui.showStartScreen();
    this.input.setVisible(false);
    this.loop();
  }

  /** Conecta los botones de la UI con los estados del juego. */
  private wireUi(): void {
    this.ui.onStart = () => {
      this.audio.init(); // requiere gesto del usuario
      this.startPlaying();
      this.playIntro();
    };
    this.ui.onPause = () => {
      if (this.state !== 'playing') return;
      this.state = 'paused';
      this.audio.stopMusic();
      this.ui.showPauseScreen();
    };
    this.ui.onResume = () => this.startPlaying();
    this.ui.onRestart = () => {
      this.clearIntro();
      this.buildWorld();
      this.startPlaying();
    };
  }

  private startPlaying(): void {
    this.ui.hideOverlay();
    this.input.setVisible(true);
    this.audio.startMusic();
    this.state = 'playing';
  }

  /** Diálogo de apertura del capítulo (escrito por dirección creativa). */
  private playIntro(): void {
    this.clearIntro();
    const script: [number, Parameters<UIManager['say']>[0], string][] = [
      [200, 'Oryn', 'Mael… dime que esto es temporal.'],
      [3800, 'Mael', 'Lo es. Aunque debo admitir que brillas bastante bien.'],
      [7400, 'Elaria', 'La isla ha sido herida. Si Auria se apaga, tu amigo también se perderá.'],
      [11400, 'Oryn', 'Bueno… supongo que seguimos a la lucecita misteriosa.'],
    ];
    for (const [delay, speaker, text] of script) {
      this.introTimers.push(setTimeout(() => this.ui.say(speaker, text), delay));
    }
  }

  private clearIntro(): void {
    for (const t of this.introTimers) clearTimeout(t);
    this.introTimers = [];
  }

  /** Crea (o recrea) la escena completa del nivel "Costa Brillante". */
  private buildWorld(): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x7fd4e8); // cielo caribeño
    this.scene.fog = new THREE.Fog(0x7fd4e8, 35, 90);

    // Iluminación: sol dorado de isla + luz ambiente cálida del cielo
    const hemi = new THREE.HemisphereLight(0xd8f0ff, 0x7aae6e, 0.95);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffe2a8, 1.5);
    sun.position.set(12, 30, -20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -45;
    sun.shadow.camera.right = 45;
    sun.shadow.camera.top = 45;
    sun.shadow.camera.bottom = -55;
    sun.shadow.camera.far = 100;
    sun.target.position.set(0, 0, -35);
    this.scene.add(sun, sun.target);

    this.effects = new Effects(this.scene);
    this.level = new LevelManager(this.scene);
    // Cada caja esconde 2 Lumas: cuentan en el total desde el principio
    this.collectibles = new CollectibleManager(
      this.scene, this.effects, this.level.crystalPositions, this.level.crates.length * 2,
    );
    this.enemies = new EnemyController(this.scene, this.effects, this.level.enemyDefs);
    this.goal = new GoalPortal(this.scene, this.level.goalPosition, this.level.groundMeshes);
    this.player = new PlayerController(
      this.scene, this.input, this.level.groundMeshes, this.level.obstacles,
      this.level.checkpoints, this.level.killY,
    );
    this.oryn = new CompanionOryn(this.scene);
    this.liora = new Liora(this.scene, this.level.checkpoints, this.level.goalPosition);
    this.cameraCtrl = new CameraController(this.container.clientWidth / Math.max(this.container.clientHeight, 1));
    this.cameraCtrl.snapTo(this.player.position);

    this.health.reset();
    this.storyFlags = { firstLuma: false, firstKill: false, reward: false, nearGoal: false };
    this.ui.setHealth(this.health.health);
    this.ui.setLumas(0, this.collectibles.total);

    this.wireGameplay();
  }

  /** Conecta los eventos de gameplay entre los sistemas. */
  private wireGameplay(): void {
    // Salto y ataque → sonido + efectos
    this.player.onJump = (isDouble) => (isDouble ? this.audio.playDoubleJump() : this.audio.playJump());
    this.player.onAttack = (center, radius, kind) => {
      this.audio.playAttack();
      if (kind === 'spin') {
        this.effects.ring(this.player.position.clone(), 0x9fe8ff, radius);
      } else {
        this.effects.burst(center.clone().add(new THREE.Vector3(0, 1, 0)), 0xffd34d, 6, 3);
      }
      // El ataque afecta a enemigos y cajas dentro del radio
      this.enemies.attackAt(center, radius);
      for (const cratePos of this.level.breakCratesNear(center, radius)) {
        this.audio.playBreak();
        this.effects.burst(cratePos, 0xc98f4e, 12, 4);
        // Cada caja suelta 2 Lumas
        this.collectibles.spawnCrystal(cratePos.clone().add(new THREE.Vector3(0.4, 0.6, 0)));
        this.collectibles.spawnCrystal(cratePos.clone().add(new THREE.Vector3(-0.4, 0.6, 0)));
        this.ui.setLumas(this.collectibles.collected, this.collectibles.total);
      }
    };

    // Caída fuera del mapa → daño + respawn en el último checkpoint
    this.player.onFellOffMap = () => {
      this.health.takeDamage();
      if (this.health.health > 0) {
        this.player.respawn();
        this.cameraCtrl.snapTo(this.player.position);
        this.audio.playHurt();
        this.ui.say('Oryn', 'El agua está genial… para los peces. ¡Arriba!');
      }
    };

    // Contacto con Grubs corrompidos por la Noxia → daño + retroceso
    this.enemies.onPlayerHit = (enemyPos) => {
      if (this.health.takeDamage()) {
        this.player.applyHit(enemyPos);
        this.audio.playHurt();
        this.ui.say('Oryn', '¡Cuidado! La Noxia los ha vuelto gruñones.');
      }
    };
    this.enemies.onEnemyDefeated = () => {
      this.audio.playEnemyDown();
      if (!this.storyFlags.firstKill) {
        this.storyFlags.firstKill = true;
        this.ui.say('Oryn', '¡Toma ya! Casi me despeino.');
      }
    };

    // Lumas → contador + sonido (y Liora brilla más)
    this.collectibles.onCollect = (collected, total) => {
      this.ui.setLumas(collected, total);
      this.audio.playPickup();
      if (!this.storyFlags.firstLuma) {
        this.storyFlags.firstLuma = true;
        this.ui.say('Oryn', '¡Un Luma! Siento su energía… espera, ¿ahora siento energía?');
      }
    };

    // Vida → UI + derrota
    this.health.onChange = (h) => this.ui.setHealth(h);
    this.health.onDeath = () => {
      this.state = 'defeat';
      this.audio.stopMusic();
      this.audio.playDefeat();
      this.input.setVisible(false);
      this.ui.showDefeatScreen();
    };

    // Meta → victoria
    this.goal.onReached = () => {
      this.state = 'victory';
      this.audio.stopMusic();
      this.audio.playVictory();
      this.input.setVisible(false);
      this.ui.showVictoryScreen(this.collectibles.collected, this.collectibles.total);
    };
  }

  /** Bucle principal. */
  private loop = (): void => {
    this.rafId = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05); // clamp anti-tirones

    if (this.state === 'playing') {
      this.player.update(dt);
      this.health.update(dt);
      this.enemies.update(dt, this.player.position);
      this.collectibles.update(dt, this.player.position);
      this.goal.update(dt, this.player.position);
      this.oryn.update(dt, this.player.position, this.player.facingY);
      // Liora brilla según la fracción de Lumas recuperados
      this.liora.update(dt, this.player.position, this.collectibles.collected / Math.max(this.collectibles.total, 1));
      this.cameraCtrl.update(dt, this.player.position);
      this.storyMoments();
      // Ambiente sonoro: un Quirí canta de vez en cuando
      this.quiriTimer -= dt;
      if (this.quiriTimer <= 0) {
        this.audio.playQuiri();
        this.quiriTimer = 6 + Math.random() * 8;
      }
    }
    // El ambiente sigue vivo incluso en pausa/menús (vibra de isla)
    this.level.update(dt);
    this.effects.update(dt);

    this.renderer.render(this.scene, this.cameraCtrl.camera);
  };

  /** Momentos narrativos contextuales según la zona explorada. */
  private storyMoments(): void {
    const p = this.player.position;
    if (!this.storyFlags.reward && p.y > 5.5 && p.x < -3 && this.player.grounded) {
      this.storyFlags.reward = true;
      this.ui.say('Oryn', '¡Ohhh! Tesoro a la vista. Yo lo vi primero.');
    }
    if (!this.storyFlags.nearGoal && p.z < -56) {
      this.storyFlags.nearGoal = true;
      this.ui.say('Elaria', 'El santuario despierta… acércate al tótem, Mael.');
    }
  }

  private handleResize = (): void => {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.cameraCtrl.resize(w / Math.max(h, 1));
  };

  dispose(): void {
    cancelAnimationFrame(this.rafId);
    this.clearIntro();
    window.removeEventListener('resize', this.handleResize);
    this.audio.dispose();
    this.input.dispose();
    this.ui.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
