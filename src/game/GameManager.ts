import * as THREE from 'three';
import { AudioManager } from './AudioManager';
import { CameraController } from './CameraController';
import { CaracoralBrute } from './CaracoralBrute';
import { CollectibleManager } from './CollectibleManager';
import { CompanionOryn } from './CompanionOryn';
import { DestelloSystem } from './DestelloSystem';
import { Effects } from './Effects';
import { EnemyController } from './EnemyController';
import { HealthSystem } from './HealthSystem';
import { LevelManager } from './LevelManager';
import { Liora } from './Liora';
import { MobileInputController } from './MobileInputController';
import { PlayerController } from './PlayerController';
import { UIManager } from './UIManager';

type GameState = 'ready' | 'playing' | 'paused' | 'faro' | 'defeat';

/**
 * GameManager
 * ------------
 * Orquestador de la aventura de Costa Brillante: crea el mundo abierto,
 * conecta los sistemas (Destellos, Lumas-moneda, Caracoral, olfato de
 * Oryn, santuarios, faro) y ejecuta el bucle. El objetivo del nivel es
 * reunir 3 Destellos de Auralis y activar el Faro del Alba.
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
  private brute!: CaracoralBrute;
  private collectibles!: CollectibleManager;
  private destellos!: DestelloSystem;
  private effects!: Effects;
  private health = new HealthSystem();

  // Estado de aventura
  private faroDone = false;
  private storyFlags = { firstLuma: false, firstKill: false, bruteSeen: false };
  private triggerCooldowns = new Map<string, number>();
  private introTimers: ReturnType<typeof setTimeout>[] = [];
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
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
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

  // ------------------------------------------------------------------
  // UI / estados
  // ------------------------------------------------------------------

  private wireUi(): void {
    this.ui.onStart = () => {
      this.audio.init();
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
    this.ui.onContinue = () => this.startPlaying();
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

  /** Apertura del capítulo: presenta el objetivo, no un tutorial. */
  private playIntro(): void {
    this.clearIntro();
    const script: [number, Parameters<UIManager['say']>[0], string][] = [
      [200, 'Oryn', 'Mael… el Faro del Alba está apagado. Eso no puede ser bueno.'],
      [4000, 'Elaria', 'Reúne 3 Destellos de Auralis y devuelve la luz al faro.'],
      [8000, 'Oryn', 'Veo tres caminos… y huelo secretos. ¡Tú elige por dónde!'],
    ];
    for (const [delay, speaker, text] of script) {
      this.introTimers.push(setTimeout(() => this.ui.say(speaker, text), delay));
    }
  }

  private clearIntro(): void {
    for (const t of this.introTimers) clearTimeout(t);
    this.introTimers = [];
  }

  // ------------------------------------------------------------------
  // Construcción del mundo
  // ------------------------------------------------------------------

  private buildWorld(): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x7fd4e8);
    this.scene.fog = new THREE.Fog(0x9fdcec, 45, 140);

    const hemi = new THREE.HemisphereLight(0xd8f0ff, 0x8fb573, 1.0);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffdf9e, 1.7);
    sun.position.set(18, 35, -10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -50;
    sun.shadow.camera.right = 50;
    sun.shadow.camera.top = 50;
    sun.shadow.camera.bottom = -50;
    sun.shadow.camera.far = 120;
    sun.target.position.set(0, 0, -10);
    this.scene.add(sun, sun.target);

    this.effects = new Effects(this.scene);
    this.level = new LevelManager(this.scene);
    this.collectibles = new CollectibleManager(
      this.scene, this.effects, this.level.crystalPositions, this.level.crates.length * 2,
    );
    this.destellos = new DestelloSystem(this.scene, this.effects);
    this.enemies = new EnemyController(this.scene, this.effects, this.level.enemyDefs);
    this.brute = new CaracoralBrute(
      this.scene, this.effects, this.level.westCenter.clone(),
      this.level.corruptRocks, this.level.westBounds,
    );
    this.player = new PlayerController(
      this.scene, this.input, this.level.groundMeshes, this.level.obstacles,
      this.level.checkpoints, this.level.killY,
    );
    this.player.pads = this.level.pads;
    this.oryn = new CompanionOryn(this.scene);
    this.oryn.setSecret(this.level.orynZoneCenter, this.level.orynZoneRadius, this.level.moundPos);
    this.liora = new Liora(this.scene, [this.level.checkpoints[0]], this.level.faroPedestalPos);
    this.cameraCtrl = new CameraController(this.container.clientWidth / Math.max(this.container.clientHeight, 1));
    this.cameraCtrl.snapTo(this.player.position);

    // El Destello del Faro espera en la cima desde el principio (visible al subir)
    this.destellos.spawnVisual('faro', this.level.faroDestelloPos);

    this.faroDone = false;
    this.health.reset();
    this.storyFlags = { firstLuma: false, firstKill: false, bruteSeen: false };
    this.triggerCooldowns.clear();
    this.ui.setHealth(this.health.health);
    this.ui.setLumas(0);
    this.ui.setDestellos(0, this.destellos.total);
    this.ui.setObjective(`Explora los 3 caminos y reúne <b>${this.destellos.required} Destellos de Auralis</b>`);

    this.wireGameplay();
  }

  // ------------------------------------------------------------------
  // Cableado de gameplay
  // ------------------------------------------------------------------

  private wireGameplay(): void {
    // --- Movimiento y ataques de Mael ---
    this.player.onJump = (isDouble) => (isDouble ? this.audio.playDoubleJump() : this.audio.playJump());
    this.player.onBouncePad = () => {
      this.audio.playBoing();
      this.effects.ring(this.player.position.clone(), 0x2ec4b6, 1.6);
    };
    this.player.onAttack = (center, radius, kind) => {
      if (kind === 'pound') {
        this.audio.playPound();
        this.effects.ring(this.player.position.clone(), 0xffd34d, radius + 0.6);
      } else {
        this.audio.playAttack();
        if (kind === 'spin') this.effects.ring(this.player.position.clone(), 0x9fe8ff, radius);
        else this.effects.burst(center.clone().add(new THREE.Vector3(0, 1, 0)), 0xffd34d, 6, 3);
      }

      this.enemies.attackAt(center, radius);

      // Provocar al Caracoral: atacar cerca de él lo hace embestir hacia ti
      if (this.brute.position.distanceTo(center) < radius + 2.5) {
        this.brute.provoke(this.player.position.clone());
      }

      // Excavar la reliquia que encontró Oryn
      if (!this.level.moundDug && center.distanceTo(this.level.moundPos) < radius + 1.2) {
        this.digRelic();
      }

      for (const cratePos of this.level.breakCratesNear(center, radius)) {
        this.audio.playBreak();
        this.effects.burst(cratePos, 0xc98f4e, 12, 4);
        this.collectibles.spawnCrystal(cratePos.clone().add(new THREE.Vector3(0.4, 0.6, 0)));
        this.collectibles.spawnCrystal(cratePos.clone().add(new THREE.Vector3(-0.4, 0.6, 0)));
      }
    };

    this.player.onFellOffMap = () => {
      this.health.takeDamage();
      if (this.health.health > 0) {
        this.player.respawn();
        this.cameraCtrl.snapTo(this.player.position);
        this.audio.playHurt();
        this.ui.say('Oryn', 'El agua está genial… para los peces. ¡Arriba!');
      }
    };

    // --- Enemigos ---
    this.enemies.onPlayerHit = (enemyPos) => this.hurtPlayer(enemyPos, '¡Cuidado con los Grubs!');
    this.enemies.onStomped = () => {
      this.player.velocity.y = 11; // rebote satisfactorio
      this.audio.playJump();
    };
    this.enemies.onEnemyDefeated = (position) => {
      this.audio.playEnemyDown();
      // Los enemigos sueltan un Luma (los Lumas son recompensa, no objetivo)
      this.collectibles.spawnCrystal(position.clone().add(new THREE.Vector3(0, 0.8, 0)));
      if (!this.storyFlags.firstKill) {
        this.storyFlags.firstKill = true;
        this.ui.say('Oryn', '¡Toma ya! Y mira, soltó un Luma brillante.');
      }
    };

    // --- Caracoral Brute (el enemigo-herramienta) ---
    this.brute.onPlayerHit = (pos) => this.hurtPlayer(pos, '¡Ese caparazón pesa una tonelada!');
    this.brute.onChargeStart = () => this.audio.playCharge();
    this.brute.onRockBroken = (remaining) => {
      this.audio.playRockBreak();
      if (remaining > 0) {
        this.ui.say('Oryn', `¡Rompió la roca corrupta! Quedan ${remaining}.`);
      } else {
        // Zona purificada → Destello del Coral Dormido
        this.level.purifyWestZone();
        this.audio.playPurify();
        this.destellos.spawnVisual('coral', this.level.coralDestelloPos);
        this.ui.say('Elaria', 'La playa respira de nuevo. La Noxia retrocede.');
      }
    };

    // --- Oryn: detección de secretos ---
    this.oryn.onBark = () => {
      this.audio.playBark();
      this.ui.say('Oryn', '¡Guau! Espera… ¿acabo de ladrar? ¡Huelo algo enterrado por aquí!');
    };
    this.oryn.onFootprint = (pos) => this.effects.footprint(pos);

    // --- Lumas (moneda y recompensa secundaria) ---
    this.collectibles.onCollect = () => {
      this.ui.setLumas(this.collectibles.balance);
      this.audio.playPickup();
      if (!this.storyFlags.firstLuma) {
        this.storyFlags.firstLuma = true;
        this.ui.say('Oryn', 'Lumas: la moneda favorita de la isla. El santuario rosa cura por 10.');
      }
    };

    // --- Destellos de Auralis (el objetivo) ---
    this.destellos.onCollect = (def, count) => {
      this.audio.playDestello();
      this.ui.setDestellos(count, this.destellos.total);
      this.ui.showBanner(`✦ ¡${def.nombre}!`);
      if (count >= this.destellos.required && !this.faroDone) {
        this.ui.setObjective('¡Ya tienes 3 Destellos! <b>Vuelve al Faro del Alba</b> y actívalo');
        this.ui.say('Elaria', 'Suficiente luz reunida… el faro espera tu regreso.');
      } else if (!this.faroDone) {
        this.ui.setObjective(`Reúne <b>${this.destellos.required - count} Destello(s)</b> más y vuelve al faro`);
      }
    };

    // --- Vida ---
    this.health.onChange = (h) => this.ui.setHealth(h);
    this.health.onDeath = () => {
      this.state = 'defeat';
      this.audio.stopMusic();
      this.audio.playDefeat();
      this.input.setVisible(false);
      this.ui.showDefeatScreen();
    };
  }

  private hurtPlayer(from: THREE.Vector3, orynLine: string): void {
    if (this.health.takeDamage()) {
      this.player.applyHit(from);
      this.audio.playHurt();
      this.ui.say('Oryn', orynLine);
    }
  }

  /** Excavación de la reliquia de Oryn → Destello de Oryn. */
  private digRelic(): void {
    this.level.digMound();
    this.audio.playDig();
    this.effects.burst(this.level.moundPos.clone().add(new THREE.Vector3(0, 0.5, 0)), 0xc9a96e, 14, 4);
    this.oryn.markSecretFound();
    this.ui.say('Oryn', '¡Lo sabía! Mi olfato nuevo sí sirve para algo.');
    setTimeout(() => this.destellos.spawnVisual('oryn', this.level.orynDestelloPos), 900);
  }

  // ------------------------------------------------------------------
  // Interacciones por proximidad (faro, santuarios, teasers)
  // ------------------------------------------------------------------

  private updateInteractions(dt: number): void {
    for (const [id, t] of this.triggerCooldowns) {
      if (t > 0) this.triggerCooldowns.set(id, t - dt);
    }
    const p = this.player.position;

    // Pedestal del Faro del Alba
    if (!this.faroDone && p.distanceTo(this.level.faroPedestalPos) < 2.4) {
      if (this.destellos.count >= this.destellos.required) {
        this.activateFaro();
      } else if (this.canTrigger('faro-hint')) {
        const left = this.destellos.required - this.destellos.count;
        this.ui.say('Elaria', `El faro necesita ${left} Destello(s) más para despertar.`);
      }
    }

    // Triggers del nivel (teasers y santuario de corazones)
    for (const trigger of this.level.triggers) {
      if (p.distanceTo(trigger.position) > trigger.radius || !this.canTrigger(trigger.id)) continue;
      switch (trigger.id) {
        case 'corazones':
          if (this.health.health >= this.health.maxHealth) {
            this.ui.say('Elaria', 'Tu energía está completa, Mael.');
          } else if (this.collectibles.spend(10)) {
            this.health.reset();
            this.ui.setLumas(this.collectibles.balance);
            this.audio.playPurify();
            this.effects.burst(trigger.position.clone().add(new THREE.Vector3(0, 1.5, 0)), 0xff6b8a, 14, 4);
            this.ui.say('Elaria', 'Diez Lumas bien gastados. Corazones restaurados.');
          } else {
            this.ui.say('Oryn', 'El santuario pide 10 Lumas… a recolectar se ha dicho.');
          }
          break;
        case 'quiries':
          this.ui.say('Quirí', '♪ Perdimos nuestras 5 notas de luz… vuelve pronto, viajero ♪', 4200);
          break;
        case 'desafio':
          this.ui.say('Elaria', 'El santuario del desafío aún duerme. Su reto despertará pronto.');
          break;
        case 'cueva':
          this.ui.say('Oryn', '¡Una puerta tras la cascada! Sellada… La Cueva Azul guarda algo.');
          break;
      }
    }
  }

  private canTrigger(id: string): boolean {
    if ((this.triggerCooldowns.get(id) ?? 0) > 0) return false;
    this.triggerCooldowns.set(id, 8);
    return true;
  }

  /** Secuencia de activación del Faro del Alba. */
  private activateFaro(): void {
    this.faroDone = true;
    this.level.activateFaro();
    this.audio.playVictory();
    this.ui.setObjective('✔ Faro del Alba activado — explora lo que quede o sigue al siguiente capítulo');

    // Pequeña secuencia: reacciones + luz + pantalla de progreso
    const crystalPos = new THREE.Vector3(0, 16.6, -26);
    this.effects.burst(crystalPos, 0xffd34d, 24, 7);
    this.effects.ring(this.level.faroPedestalPos.clone(), 0xffd34d, 4);
    this.ui.say('Oryn', '¡SÍ! ¡Luz! ¡Somos héroes oficiales de la isla!', 3000);
    this.introTimers.push(setTimeout(() => {
      this.ui.say('Elaria', 'La luz no estaba perdida. Solo esperaba que alguien la reuniera.', 3600);
      this.effects.burst(crystalPos, 0xffe9a0, 18, 6);
    }, 3000));
    this.introTimers.push(setTimeout(() => {
      this.state = 'faro';
      this.input.setVisible(false);
      this.audio.stopMusic();
      const rows = this.destellos.defs.map((d) => ({
        nombre: d.nombre,
        estado: this.destellos.isComplete(d.id)
          ? ('completado' as const)
          : d.disponible ? ('pendiente' as const) : ('bloqueado' as const),
      }));
      this.ui.showFaroScreen(rows, this.collectibles.balance);
    }, 6800));
  }

  // ------------------------------------------------------------------
  // Bucle principal
  // ------------------------------------------------------------------

  private loop = (): void => {
    this.rafId = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);

    if (this.state === 'playing') {
      this.player.update(dt);
      this.health.update(dt);
      this.enemies.update(dt, this.player.position, this.player.velocity.y);
      this.brute.update(dt, this.player.position);
      this.collectibles.update(dt, this.player.position);
      this.destellos.update(dt, this.player.position);
      this.oryn.update(dt, this.player.position, this.player.facingY);
      this.liora.update(dt, this.player.position, this.destellos.count / this.destellos.required);
      this.cameraCtrl.update(dt, this.player.position, this.player.velocity);
      this.updateInteractions(dt);
      this.storyMoments();

      this.quiriTimer -= dt;
      if (this.quiriTimer <= 0) {
        this.audio.playQuiri();
        this.quiriTimer = 6 + Math.random() * 8;
      }
    }
    this.level.update(dt);
    this.effects.update(dt);

    this.renderer.render(this.scene, this.cameraCtrl.camera);
  };

  /** Reacciones contextuales al explorar. */
  private storyMoments(): void {
    const p = this.player.position;
    if (!this.storyFlags.bruteSeen && p.x < -16) {
      this.storyFlags.bruteSeen = true;
      this.ui.say('Oryn', 'Ese caracol gigante embiste si te acercas… ¡úsalo contra las rocas moradas!', 4500);
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
