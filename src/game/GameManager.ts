import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
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
import { SkyDome } from './SkyDome';
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
  private composer!: EffectComposer;
  private bloomPass!: UnrealBloomPass;
  private envTexture: THREE.Texture | null = null;
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

  // Calidad adaptativa: si el dispositivo no llega a ~40 fps sostenidos,
  // baja la resolución interna y apaga el bloom automáticamente.
  private lowFpsTime = 0;
  private qualityLowered = false;

  // Estado de aventura
  private faroDone = false;
  private playerInCave = false;
  private notesCollected = 0;
  /** Arena de oleadas: -1 inactiva, 0-2 oleada en curso, 3 completada. */
  private arenaWave = -1;
  private arenaBaseline = 0;
  private storyFlags = { firstLuma: false, firstKill: false, bruteSeen: false };
  private triggerCooldowns = new Map<string, number>();
  private secretsFound = new Set<string>();
  private introTimers: ReturnType<typeof setTimeout>[] = [];
  private quiriTimer = 5;

  constructor(container: HTMLElement) {
    this.container = container;
    container.style.position = 'relative';
    container.style.overflow = 'hidden';
    container.style.touchAction = 'none';

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
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
      this.ui.showPauseScreen(this.destelloRows(), this.collectibles.balance,
        this.player.position.x, this.player.position.z);
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
    this.scene.fog = new THREE.Fog(0x9fd6e8, 60, 170);

    // Iluminación ambiental basada en imagen: reflejos y profundidad reales
    if (!this.envTexture) {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
    }
    this.scene.environment = this.envTexture;
    // El IBL sustituye gran parte de la luz ambiente: bajarlo para no quemar
    this.scene.environmentIntensity = 0.4;

    // Cielo procedural: gradiente + sol con halo (alimenta el bloom)
    const sunDir = new THREE.Vector3(18, 35, -10);
    new SkyDome(this.scene, sunDir);

    const hemi = new THREE.HemisphereLight(0xd8f0ff, 0x8fb573, 0.35);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffdf9e, 1.25);
    sun.position.set(18, 35, -10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -38;
    sun.shadow.camera.right = 38;
    sun.shadow.camera.top = 42;
    sun.shadow.camera.bottom = -42;
    sun.shadow.camera.far = 110;
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

    // Post-procesado: render + bloom (la magia brilla de verdad) + salida
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.cameraCtrl.camera));
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(this.container.clientWidth, this.container.clientHeight),
      0.38,  // intensidad
      0.5,   // radio
      0.92,  // umbral alto: solo brilla lo realmente luminoso (emisivos, sol)
    );
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());

    // El Destello del Faro espera en la cima desde el principio (visible al subir)
    this.destellos.spawnVisual('faro', this.level.faroDestelloPos);

    this.faroDone = false;
    this.playerInCave = false;
    this.notesCollected = 0;
    this.arenaWave = -1;
    this.health.reset();
    this.storyFlags = { firstLuma: false, firstKill: false, bruteSeen: false };
    this.triggerCooldowns.clear();
    this.secretsFound.clear();
    this.ui.setHealth(this.health.health);
    this.ui.setLumas(0);
    this.ui.setDestellos(0, this.destellos.required);
    this.ui.setNoxiaNearby(false);
    this.ui.setObjective(`Reúne <b>${this.destellos.required} Destellos de Auralis</b>`);

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

      this.applyAttackHit(center, radius);
    };

    this.player.onFellOffMap = () => {
      if (this.health.takeDamage()) this.ui.setHealth(this.health.health, true);
      if (this.health.health > 0) {
        this.player.respawn();
        this.cameraCtrl.snapTo(this.player.position);
        this.audio.playHurt();
        this.ui.say('Oryn', 'El agua está genial… para los peces. ¡Arriba!');
      }
    };

    // --- Enemigos ---
    this.enemies.onPlayerHit = (enemyPos) => this.hurtPlayer(enemyPos, '¡Cuidado con los Coquíl Sprigs!');
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
        this.ui.setNoxiaNearby(false);
        this.ui.showBanner('🌺 Zona purificada', 'purified');
        this.destellos.spawnVisual('coral', this.level.coralDestelloPos);
        this.ui.say('Elaria', 'La playa respira de nuevo. La Noxia retrocede.');
      }
    };

    // --- Oryn: detección de secretos ---
    this.oryn.onBark = () => {
      this.audio.playBark();
      this.ui.showOrynToast(); // toast pequeño, no pausa el juego (guía §12)
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
      // Estados visuales del faro: se va cargando con cada Destello
      this.level.setFaroCharge(count);
      this.ui.setDestellos(count, this.destellos.required, this.faroDone ? this.destellos.total : undefined);
      this.ui.showBanner(`⭐ ¡${def.nombre}!`);
      if (count >= this.destellos.required && !this.faroDone) {
        this.ui.setObjective('<b>Activa el Faro del Alba</b>');
        this.ui.say('Elaria', 'Suficiente luz reunida… el faro espera tu regreso.');
      } else if (!this.faroDone) {
        this.ui.setObjective(`Reúne <b>${this.destellos.required - count} Destello(s)</b> más`);
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

  /**
   * Aplica el daño del ataque al mundo (enemigos, Caracoral, reliquia,
   * cajas). Se llama al iniciar el ataque Y cada frame mientras dura la
   * animación, para que conecte aunque el enemigo entre en rango durante
   * el giro o la embestida.
   */
  private applyAttackHit(center: THREE.Vector3, radius: number): void {
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
  }

  private hurtPlayer(from: THREE.Vector3, orynLine: string): void {
    if (this.health.takeDamage()) {
      this.player.applyHit(from);
      this.audio.playHurt();
      this.ui.setHealth(this.health.health, true); // flash coral + tembleque
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

    // Vignette violeta: Noxia activa en la playa oeste sin purificar
    const noxiaActive = this.level.corruptRocks.some((r) => !r.broken);
    const inWest = p.x < this.level.westBounds.maxX + 3 && p.x > this.level.westBounds.minX - 3 &&
      p.z > this.level.westBounds.minZ - 3 && p.z < this.level.westBounds.maxZ + 3;
    this.ui.setNoxiaNearby(noxiaActive && inWest);

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
          this.secretsFound.add('quiries');
          if (this.destellos.isComplete('quiries')) break;
          if (this.notesCollected >= 5) {
            // Misión completada: el altar libera el Canto de los Quiríes
            this.audio.playPurify();
            this.destellos.spawnVisual('quiries', this.level.quiriDestelloPos);
            this.ui.say('Quirí', '♪ ¡Nuestras notas! La arboleda vuelve a cantar contigo ♪', 4200);
          } else {
            this.ui.say('Quirí', `♪ Perdimos 5 Notas de Luz… llevas ${this.notesCollected}/5. Busca en árbol, ruinas, cueva, cascada y altura ♪`, 4600);
          }
          break;
        case 'desafio':
          this.secretsFound.add('desafio');
          if (this.destellos.isComplete('desafio') || this.arenaWave >= 0) break;
          // Arranca la arena de oleadas (baseline = enemigos del mundo vivos)
          this.arenaWave = 0;
          this.arenaBaseline = this.enemies.aliveCount;
          this.spawnArenaWave();
          this.ui.say('Elaria', 'El santuario despierta… ¡resiste sus tres oleadas, Mael!');
          break;
        case 'cueva':
          this.secretsFound.add('cueva');
          // Entrar a la Cueva Azul (tras la cascada)
          this.playerInCave = true;
          this.player.group.position.copy(this.level.caveInsidePos);
          this.player.velocity.set(0, 0, 0);
          this.cameraCtrl.snapTo(this.player.position);
          this.audio.playPurify();
          this.ui.say('Oryn', 'La Cueva Azul… ¡mira esos cristales! Pisa las dos placas brillantes.');
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
    // Paso 5 del LDD: la luz purifica la isla (flores brotan en el hub)
    this.introTimers.push(setTimeout(() => {
      this.level.purifyIsland();
      this.audio.playPurify();
      this.ui.showBanner('🌺 La isla respira de nuevo', 'purified');
    }, 5200));
    this.introTimers.push(setTimeout(() => {
      this.state = 'faro';
      this.input.setVisible(false);
      this.audio.stopMusic();
      this.ui.setDestellos(this.destellos.count, this.destellos.required, this.destellos.total);
      this.ui.showFaroScreen(
        this.destelloRows(), this.collectibles.balance,
        this.secretsFound.size, this.completionPercent(),
      );
    }, 6800));
  }

  /** Filas de Destellos para pausa/mapa/pantalla final. */
  private destelloRows() {
    const mapPos: Record<string, [number, number]> = {
      faro: [0, -26], coral: [-26, -4], oryn: [30, -10],
      quiries: [11.5, 4], cueva: [10.5, -22], desafio: [-11, 6],
    };
    return this.destellos.defs.map((d) => ({
      nombre: d.nombre,
      tipo: d.tipo,
      estado: this.destellos.isComplete(d.id)
        ? ('completado' as const)
        : d.disponible ? ('pendiente' as const) : ('bloqueado' as const),
      x: mapPos[d.id][0],
      z: mapPos[d.id][1],
    }));
  }

  /** % de Costa Brillante: Destellos 60 · Lumas 25 · secretos 15. */
  private completionPercent(): number {
    const lumaFrac = Math.min(this.collectibles.collected / Math.max(this.collectibles.total, 1), 1);
    return Math.round(
      (this.destellos.count / this.destellos.total) * 60 +
      lumaFrac * 25 +
      (this.secretsFound.size / 3) * 15,
    );
  }

  /** Cueva Azul: placas de presión → puente cristalino → cofre → salida. */
  private updateCave(): void {
    if (!this.playerInCave) return;
    const p = this.player.position;

    // Placas de presión
    for (const plate of this.level.cavePlates) {
      if (plate.pressed) continue;
      if (p.distanceTo(plate.pos) < 1.0 && this.player.grounded) {
        this.level.pressPlate(plate);
        this.audio.playPickup();
        this.effects.ring(plate.pos.clone(), 0x2ec4b6, 1.6);
        const remaining = this.level.cavePlates.filter((pl) => !pl.pressed).length;
        if (remaining === 0 && !this.level.caveBridgeOpen) {
          this.level.openCaveBridge();
          this.audio.playPurify();
          this.ui.say('Oryn', '¡El puente de cristal! Sabía que esas placas hacían algo.');
        } else if (remaining > 0) {
          this.ui.say('Oryn', `Una placa encendida… falta ${remaining}.`);
        }
      }
    }

    // Cofre del Destello (se abre con un ataque cerca)
    if (this.level.caveBridgeOpen && !this.level.caveChestOpened && this.player.attacking) {
      if (p.distanceTo(this.level.caveChestPos) < 2.2) {
        this.level.openCaveChest();
        this.audio.playBreak();
        this.effects.burst(this.level.caveChestPos.clone(), 0xffd34d, 16, 5);
        // Lumas del cofre + el Eco del Santuario
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          this.collectibles.spawnCrystal(this.level.caveChestPos.clone()
            .add(new THREE.Vector3(Math.cos(a) * 0.9, 0.4, Math.sin(a) * 0.9)));
        }
        setTimeout(() => this.destellos.spawnVisual('cueva', this.level.caveDestelloPos), 700);
      }
    }

    // Portal de salida
    if (p.distanceTo(this.level.caveExitPos) < 1.6) {
      this.triggerCooldowns.set('cueva', 6);
      this.playerInCave = false;
      this.player.group.position.copy(this.level.caveOutsidePos);
      this.player.velocity.set(0, 0, 0);
      this.cameraCtrl.snapTo(this.player.position);
      this.audio.playQuiri();
    }
  }

  /** Notas de Luz: recogida por proximidad con progreso en pantalla. */
  private updateNotes(): void {
    if (this.notesCollected >= 5) return;
    const p = this.player.position;
    for (const note of this.level.notes) {
      if (note.collected) continue;
      if (p.distanceTo(note.group.position) < 1.5) {
        note.collected = true;
        note.group.visible = false;
        this.notesCollected++;
        this.audio.playQuiri();
        this.effects.burst(note.group.position.clone(), 0xffe28a, 10, 4);
        this.ui.showBanner(`♪ Nota de Luz ${this.notesCollected}/5`, 'auralis', 1800);
        if (this.notesCollected >= 5) {
          this.ui.say('Oryn', '¡Las cinco notas! Llévaselas a los Quiríes de la arboleda.');
        }
      }
    }
  }

  /** Arena del Santuario del Desafío: tres oleadas de Coquíls. */
  private spawnArenaWave(): void {
    const count = 3 + this.arenaWave; // 3, 4, 5
    const c = this.level.arenaCenter;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + this.arenaWave;
      const x = c.x + Math.cos(a) * 3.6;
      const z = c.z + Math.sin(a) * 3.2;
      this.enemies.spawn({
        pointA: new THREE.Vector3(x, 1, z),
        pointB: new THREE.Vector3(c.x + Math.cos(a + 1.5) * 2.2, 1, c.z + Math.sin(a + 1.5) * 2),
      });
    }
    this.level.setArenaWave(this.arenaWave + 1);
    this.audio.playCharge();
    this.ui.showBanner(`Oleada ${this.arenaWave + 1} / 3`, 'auralis', 2000);
  }

  private updateArena(): void {
    if (this.arenaWave < 0 || this.arenaWave >= 3) return;
    if (this.enemies.aliveCount > this.arenaBaseline) return;
    this.arenaBaseline = Math.min(this.arenaBaseline, this.enemies.aliveCount);
    // Oleada superada
    this.arenaWave++;
    if (this.arenaWave < 3) {
      this.spawnArenaWave();
    } else {
      this.audio.playPurify();
      this.ui.say('Elaria', 'Tres oleadas. El santuario reconoce tu valor.');
      this.destellos.spawnVisual('desafio', this.level.arenaDestelloPos);
      // Lumas raros de recompensa
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        this.collectibles.spawnCrystal(this.level.arenaCenter.clone()
          .add(new THREE.Vector3(Math.cos(a) * 2, 1.2, Math.sin(a) * 2)));
      }
    }
  }

  // ------------------------------------------------------------------
  // Bucle principal
  // ------------------------------------------------------------------

  private loop = (): void => {
    this.rafId = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);

    if (this.state === 'playing') {
      this.player.cameraYaw = this.cameraCtrl.yaw;
      this.player.update(dt);
      // Hitbox activo durante TODA la ventana del ataque (no solo el 1er frame)
      if (this.player.attacking) {
        for (const { center, radius } of this.player.getAttackHitboxes()) {
          this.applyAttackHit(center, radius);
        }
      }
      this.health.update(dt);
      this.enemies.update(dt, this.player.position, this.player.velocity.y);
      this.brute.update(dt, this.player.position);
      this.collectibles.update(dt, this.player.position);
      this.destellos.update(dt, this.player.position);
      this.oryn.update(dt, this.player.position, this.player.facingY);
      this.liora.update(dt, this.player.position, this.destellos.count / this.destellos.required);
      this.cameraCtrl.update(dt, this.player.position, this.player.velocity);
      this.updateInteractions(dt);
      this.updateCave();
      this.updateNotes();
      this.updateArena();
      this.storyMoments();

      this.quiriTimer -= dt;
      if (this.quiriTimer <= 0) {
        this.audio.playQuiri();
        this.quiriTimer = 6 + Math.random() * 8;
      }
    }
    this.level.update(dt);
    this.effects.update(dt);

    this.updateAdaptiveQuality(dt);
    this.composer.render();
  };

  /** Baja la calidad una vez si el framerate sostenido es bajo. */
  private updateAdaptiveQuality(dt: number): void {
    if (this.qualityLowered) return;
    // dt llega recortado a 0.05: usamos eso como señal de frame lento (>25ms)
    if (dt > 0.025) this.lowFpsTime += dt;
    else this.lowFpsTime = Math.max(this.lowFpsTime - dt * 0.5, 0);
    if (this.lowFpsTime > 2.5) {
      this.qualityLowered = true;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.15));
      this.bloomPass.enabled = false;
      this.handleResize();
    }
  }

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
    this.composer?.setSize(w, h);
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
