import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { AssetLibrary } from './AssetLibrary';
import { Atmosphere } from './Atmosphere';
import { AudioManager } from './AudioManager';
import { CameraController } from './CameraController';
import { CaracoralBrute } from './CaracoralBrute';
import { CollectibleManager } from './CollectibleManager';
import { cloudTimeUniform } from './CloudShadows';
import { CompanionOryn } from './CompanionOryn';
import { CutsceneSystem } from './CutsceneSystem';
import { ElariaApparition } from './ElariaApparition';
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
import { Vegetation } from './Vegetation';
import { VoiceSystem } from './VoiceSystem';

type GameState = 'ready' | 'playing' | 'paused' | 'cutscene' | 'faro' | 'defeat';

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
  private voice = new VoiceSystem();
  private assets = new AssetLibrary();

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
  private cutscene!: CutsceneSystem;
  private elaria!: ElariaApparition;
  private sun!: THREE.DirectionalLight;
  private vegetation!: Vegetation;
  private atmosphere!: Atmosphere;
  /** Estado al que volver cuando termina la cutscene. */
  private postCutsceneState: GameState = 'playing';

  // Calidad adaptativa: si el dispositivo no llega a ~40 fps sostenidos,
  // baja la resolución interna y apaga el bloom automáticamente.
  private lowFpsTime = 0;
  private qualityLowered = false;
  /** ?fx=off — render directo sin postproceso (depuración). */
  private directRender = false;
  /** ?view=top|side — vistas de validación de blockout con etiquetas. */
  private debugView: string | null = null;

  // Estado de aventura
  private faroDone = false;
  private playerInCave = false;
  private notesCollected = 0;
  /** Desafío cronometrado: plataformas temporales + timer (spec §8). */
  private challengeActive = false;
  private challengeDone = false;
  private challengeTimer = 0;
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
    this.input.setVisible(false);
    this.ui.setHudVisible(false);

    // El menú aparece AL INSTANTE (con "Cargando…") y el mundo se
    // construye detrás; al terminar, el botón pasa a "Jugar".
    this.ui.showStartScreen();
    void this.bootstrap();
  }

  /** Precarga la librería de assets y levanta el mundo. */
  private async bootstrap(): Promise<void> {
    await this.assets.preload(['mael', 'oryn', 'tree', 'rock', 'house']);
    this.buildWorld();
    this.handleResize();
    window.addEventListener('resize', this.handleResize);
    this.ui.setStartReady(true);
    if (this.debugView) {
      this.ui.hideOverlay();
      this.ui.setHudVisible(false);
    }
    this.loop();
  }

  /** Vistas de blockout (FASE 5): top con grid o alzado lateral. */
  private setupDebugView(view: string): void {
    const cam = this.cameraCtrl.camera;
    cam.far = 1600;
    this.scene.fog = null; // vistas técnicas: sin niebla
    if (view === 'top') {
      cam.position.set(0, 560, -10);
      cam.up.set(0, 0, -1);
      cam.lookAt(0, 0, -10);
      const grid = new THREE.GridHelper(440, 22, 0xffffff, 0x88aabb);
      (grid.material as THREE.Material).transparent = true;
      (grid.material as THREE.Material).opacity = 0.35;
      grid.position.set(0, 3, -10);
      this.scene.add(grid);
    } else {
      // Alzado desde el OESTE (la sala de la Cueva Azul está al este, fuera)
      cam.position.set(-620, 95, -40);
      cam.lookAt(0, 55, -40);
    }
    cam.updateProjectionMatrix();
    // Etiquetas de zona (comentarios en escena)
    const zones: [string, number, number, number][] = [
      ['1 HUB PLAYA', 0, 14, 140], ['2 CORAL', -85, 16, 80], ['3 CUEVA AZUL', -79, 34, -60],
      ['4 RUTA VERTICAL', 4, 62, -124], ['5 FARO', 0, 122, -170], ['6 ARBOLEDA', 95, 36, 35],
      ['7 SENDERO ORYN', 58, 28, -18], ['8 DESAFIO', -55, 50, -95],
      ['CIUDAD BAJA y12', 0, 26, -20], ['CIUDAD MEDIA y28', 0, 44, -75], ['DISTRITO ALTO y58', 0, 76, -130],
    ];
    for (const [text, x, y, z] of zones) {
      const canvas = document.createElement('canvas');
      canvas.width = 512; canvas.height = 96;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = 'rgba(4,20,28,0.75)';
      ctx.fillRect(0, 0, 512, 96);
      ctx.font = 'bold 52px sans-serif';
      ctx.fillStyle = '#ffe9a0';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 256, 48);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(canvas), depthTest: false, fog: false,
      }));
      sprite.position.set(x, y, z);
      sprite.scale.set(36, 6.75, 1);
      sprite.renderOrder = 999;
      this.scene.add(sprite);
    }
  }

  // ------------------------------------------------------------------
  // UI / estados
  // ------------------------------------------------------------------

  private wireUi(): void {
    this.ui.onStart = () => {
      this.audio.init();
      this.ui.hideOverlay();
      this.playIntroCutscene();
    };
    this.ui.onPause = () => {
      if (this.state !== 'playing') return;
      this.state = 'paused';
      this.audio.stopMusic();
      this.voice.stop();
      this.ui.showPauseScreen(this.destelloRows(), this.collectibles.balance,
        this.player.position.x, this.player.position.z);
    };
    this.ui.onResume = () => this.startPlaying();
    this.ui.onSkipCutscene = () => { this.voice.stop(); this.cutscene?.skip(); };
    this.ui.onSay = (speaker, text) => this.voice.speak(speaker, text);
    this.ui.onToggleVoice = () => {
      this.voice.setMuted(!this.voice.muted);
      return this.voice.muted;
    };
    this.ui.setVoiceMuted(this.voice.muted);
    this.ui.onContinue = () => this.startPlaying();
    // Muerte sin castigo de progreso: corazones llenos + último checkpoint.
    // Destellos, Lumas, notas y misiones se conservan tal cual.
    this.ui.onRespawn = () => {
      this.health.reset();
      this.ui.setHealth(this.health.health);
      this.player.respawn();
      this.cameraCtrl.snapTo(this.player.position);
      this.startPlaying();
    };
    this.ui.onRestart = () => {
      this.clearIntro();
      this.buildWorld();
      this.startPlaying();
    };
  }

  private startPlaying(): void {
    this.ui.hideOverlay();
    this.ui.setHudVisible(true);
    this.input.setVisible(true);
    this.audio.startMusic();
    this.state = 'playing';
  }

  /** Cutscene de apertura: del faro apagado al hub, presentando el objetivo. */
  private playIntroCutscene(): void {
    this.startCutscene([
      {
        // Plano 1: el Faro del Alba, apagado, contra el cielo
        duration: 4.5,
        camFrom: new THREE.Vector3(26, 30, -76),
        camTo: new THREE.Vector3(16, 22, -64),
        lookTo: new THREE.Vector3(0, 14, -44),
        dialogue: { speaker: 'Oryn', text: 'Mael… el Faro del Alba está apagado. Eso no puede ser bueno.' },
      },
      {
        // Plano 2: barrido sobre la isla, de las terrazas al sur
        duration: 5,
        camTo: new THREE.Vector3(-26, 16, 4),
        lookTo: new THREE.Vector3(0, 4, -16),
        dialogue: { speaker: 'Elaria', text: 'Reúne 3 Destellos de Auralis y devuelve la luz al faro.' },
      },
      {
        // Plano 3: descenso hasta la espalda de Mael en el spawn
        duration: 3.5,
        camTo: this.player.position.clone().add(new THREE.Vector3(0, 7.2, 9.2)),
        lookTo: this.player.position.clone().add(new THREE.Vector3(0, 1.4, -7.5)),
        dialogue: { speaker: 'Oryn', text: 'Veo tres caminos… y huelo secretos. ¡Tú elige por dónde!' },
        onStart: () => {
          this.effects.burst(this.player.position.clone().add(new THREE.Vector3(0, 2, 0)), 0xffd34d, 10, 3);
          this.oryn.celebrate(2);
        },
      },
    ], 'playing');
  }

  /** Arranca una cutscene: congela el gameplay y cede la cámara. */
  private startCutscene(shots: Parameters<CutsceneSystem['play']>[0], after: GameState): void {
    this.postCutsceneState = after;
    this.state = 'cutscene';
    this.input.setVisible(false);
    this.ui.setCinematic(true);
    this.audio.startMusic();
    this.cutscene.play(shots, () => {
      this.ui.setCinematic(false);
      this.cameraCtrl.snapTo(this.player.position);
      if (this.postCutsceneState === 'playing') {
        this.startPlaying();
      } else if (this.postCutsceneState === 'faro') {
        this.state = 'faro';
        this.audio.stopMusic();
        this.ui.showFaroScreen(
          this.destelloRows(), this.collectibles.balance,
          this.secretsFound.size, this.completionPercent(),
        );
      } else {
        this.state = this.postCutsceneState;
      }
    });
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
    this.scene.fog = new THREE.Fog(0x9fd6e8, 160, 560);

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
    sun.position.set(60, 120, 40);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -70;
    sun.shadow.camera.right = 70;
    sun.shadow.camera.top = 75;
    sun.shadow.camera.bottom = -75;
    sun.shadow.camera.far = 400;
    this.scene.add(sun, sun.target);
    this.sun = sun;

    this.effects = new Effects(this.scene);
    this.level = new LevelManager(this.scene, this.assets);
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
    this.player.updrafts = this.level.updrafts;
    // Modelo final de Mael (public/models/mael.glb): se enchufa solo
    const maelModel = this.assets.getClone('mael', 1.72);
    if (maelModel) this.player.useGltfModel(maelModel, this.assets.getAnimations('mael'));
    this.oryn = new CompanionOryn(this.scene);
    this.oryn.setSecret(this.level.orynZoneCenter, this.level.orynZoneRadius, this.level.moundPos);
    this.liora = new Liora(this.scene, [this.level.checkpoints[0]], this.level.faroPedestalPos);
    this.cameraCtrl = new CameraController(this.container.clientWidth / Math.max(this.container.clientHeight, 1));
    this.cameraCtrl.snapTo(this.player.position);
    this.cutscene = new CutsceneSystem(this.cameraCtrl.camera, (sp, tx, dur) => this.ui.say(sp, tx, dur));
    this.elaria = new ElariaApparition(this.scene);
    // Capas de profundidad: hierba con viento, nubes y aves en órbita
    this.vegetation = new Vegetation(this.scene, this.level.groundMeshes, [
      { cx: 0, cz: 120, rx: 70, rz: 60, count: 150 },    // playa / hub
      { cx: -85, cz: 80, rx: 42, rz: 25, count: 50 },    // playa del Coral
      { cx: 0, cz: -22, rx: 48, rz: 30, count: 80 },     // distrito bajo
      { cx: 0, cz: -78, rx: 60, rz: 42, count: 90 },     // ciudad media
      { cx: 0, cz: -135, rx: 45, rz: 38, count: 50 },    // distrito alto
      { cx: 95, cz: 35, rx: 38, rz: 30, count: 80 },     // arboleda
    ]);
    this.atmosphere = new Atmosphere(this.scene);

    // Post-procesado: render + bloom (la magia brilla de verdad) + salida
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.cameraCtrl.camera));
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(this.container.clientWidth, this.container.clientHeight),
      0.5,   // intensidad
      0.4,   // radio
      1.0,   // umbral HDR: SOLO emisivos intensos y el sol (cero velo)
    );
    const params = new URLSearchParams(window.location.search);
    if (params.get('bloom') === 'off') this.bloomPass.enabled = false;
    this.debugView = params.get('view');
    if (this.debugView) this.setupDebugView(this.debugView);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());
    this.directRender = params.get('fx') === 'off';

    // El Destello del Faro espera en la cima desde el principio (visible al subir)
    this.destellos.spawnVisual('faro', this.level.faroDestelloPos);

    // Precompilar TODOS los shaders ahora: sin tirones en el primer frame
    // de la cutscene (la compilación en caliente era lo que la cortaba)
    this.renderer.compile(this.scene, this.cameraCtrl.camera);

    this.faroDone = false;
    this.playerInCave = false;
    this.notesCollected = 0;
    this.challengeActive = false;
    this.challengeDone = false;
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
        // Plano de foco: la playa purificada y su Destello
        this.startCutscene([{
          duration: 3.2,
          camTo: this.level.coralDestelloPos.clone().add(new THREE.Vector3(6, 5, 8)),
          lookTo: this.level.coralDestelloPos.clone(),
          dialogue: { speaker: 'Elaria', text: 'La playa respira de nuevo. La Noxia retrocede.' },
        }], 'playing');
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
      this.voice.stop();
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
    setTimeout(() => this.destellos.spawnVisual('oryn', this.level.orynDestelloPos), 900);
    // Plano de foco: la reliquia emergiendo de la arena
    this.startCutscene([{
      duration: 3,
      camTo: this.level.moundPos.clone().add(new THREE.Vector3(4, 3.5, 5)),
      lookTo: this.level.moundPos.clone().add(new THREE.Vector3(0, 0.8, 0)),
      dialogue: { speaker: 'Oryn', text: '¡Lo sabía! Mi olfato nuevo sí sirve para algo.' },
    }], 'playing');
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
          if (this.destellos.isComplete('desafio') || this.challengeActive) break;
          // Reto cronometrado: plataformas temporales hasta el pedestal
          this.challengeActive = true;
          this.challengeTimer = 45;
          this.level.setChallengeActive(true);
          this.audio.playCharge();
          this.ui.showBanner('⏱ ¡45 segundos!', 'auralis', 2200);
          this.ui.say('Elaria', 'Las plataformas no esperarán: alcanza el pedestal antes de que se desvanezcan.');
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

  /** Secuencia de activación del Faro del Alba (cutscene, LDD §6). */
  private activateFaro(): void {
    this.faroDone = true;
    this.ui.setObjective('✔ Faro del Alba activado');
    this.ui.setDestellos(this.destellos.count, this.destellos.required, this.destellos.total);
    const crystalPos = new THREE.Vector3(0, 21.5, -44);
    const pedestal = this.level.faroPedestalPos;

    this.startCutscene([
      {
        // Paso 1-2: colocar los Destellos + reacción de Oryn
        duration: 4,
        camFrom: pedestal.clone().add(new THREE.Vector3(5, 3, 6)),
        camTo: pedestal.clone().add(new THREE.Vector3(3, 2.2, 4)),
        lookTo: pedestal.clone().add(new THREE.Vector3(0, 0.8, 0)),
        dialogue: { speaker: 'Oryn', text: '¡Los Destellos! ¡Colócalos, colócalos!' },
        onStart: () => {
          this.effects.ring(pedestal.clone(), 0xffd34d, 3);
          this.effects.burst(pedestal.clone().add(new THREE.Vector3(0, 1, 0)), 0xffd34d, 14, 4);
          this.oryn.celebrate(4);
          this.audio.playDestello();
        },
      },
      {
        // Paso 3: aparición de Elaria
        duration: 4.5,
        camTo: pedestal.clone().add(new THREE.Vector3(-4, 2.5, 5)),
        lookTo: pedestal.clone().add(new THREE.Vector3(2, 1.5, -1)),
        dialogue: { speaker: 'Elaria', text: 'La luz no estaba perdida. Solo esperaba que alguien la reuniera.' },
        onStart: () => {
          this.elaria.appearAt(pedestal.clone().add(new THREE.Vector3(2.5, 0.4, -2)), this.player.position);
          this.audio.playPurify();
        },
      },
      {
        // Paso 4: el rayo del faro se abre hacia el cielo
        duration: 5,
        camTo: new THREE.Vector3(12, 26, -60),
        lookTo: crystalPos,
        dialogue: { speaker: 'Liora', text: '✦' },
        onStart: () => {
          this.level.activateFaro();
          this.audio.playVictory();
          this.effects.burst(crystalPos, 0xffd34d, 26, 8);
          this.effects.burst(crystalPos, 0xffe9a0, 18, 5);
        },
      },
      {
        // Pasos 5-6: la luz purifica la isla y abre la siguiente ruta
        duration: 5.5,
        camTo: new THREE.Vector3(0, 38, 14),
        lookTo: new THREE.Vector3(0, 6, -18),
        dialogue: { speaker: 'Oryn', text: '¡SÍ! ¡Luz! ¡Somos héroes oficiales de la isla!' },
        onStart: () => {
          this.level.purifyIsland();
          this.audio.playPurify();
          this.ui.showBanner('🌺 La isla respira de nuevo', 'purified');
          this.elaria.fadeOut();
        },
      },
    ], 'faro');

  }

  /** Cueva Azul: placas de presión → puente cristalino → cofre → salida. */
  private updateCave(): void {
    if (!this.playerInCave) return;
    const p = this.player.position;

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

    if (this.level.caveBridgeOpen && !this.level.caveChestOpened && this.player.attacking) {
      if (p.distanceTo(this.level.caveChestPos) < 2.2) {
        this.level.openCaveChest();
        this.audio.playBreak();
        this.effects.burst(this.level.caveChestPos.clone(), 0xffd34d, 16, 5);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          this.collectibles.spawnCrystal(this.level.caveChestPos.clone()
            .add(new THREE.Vector3(Math.cos(a) * 0.9, 0.4, Math.sin(a) * 0.9)));
        }
        setTimeout(() => this.destellos.spawnVisual('cueva', this.level.caveDestelloPos), 700);
      }
    }

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

  /** Desafío de Mael: plataformas temporales contra el reloj (spec §8). */
  private updateArena(dt: number): void {
    if (!this.challengeActive) return;
    this.challengeTimer -= dt;

    // ¿Llegó al pedestal flotante a tiempo?
    if (this.player.position.distanceTo(this.level.challengePedestalPos) < 3) {
      this.challengeActive = false;
      this.challengeDone = true;
      this.audio.playPurify();
      this.ui.say('Elaria', 'Dominio y velocidad. El santuario te corona.');
      this.destellos.spawnVisual('desafio', this.level.arenaDestelloPos);
      // Lumas raros de recompensa
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        this.collectibles.spawnCrystal(this.level.challengePedestalPos.clone()
          .add(new THREE.Vector3(Math.cos(a) * 2.4, 1, Math.sin(a) * 2.4)));
      }
      this.ui.setObjective(this.destellos.count >= this.destellos.required && !this.faroDone
        ? '<b>Activa el Faro del Alba</b>'
        : `Reúne <b>${Math.max(this.destellos.required - this.destellos.count, 0)} Destello(s)</b> más`);
      return;
    }

    // Tiempo agotado: las plataformas se desvanecen (se puede reintentar)
    if (this.challengeTimer <= 0) {
      this.challengeActive = false;
      this.level.setChallengeActive(false);
      this.audio.playHurt();
      this.ui.showBanner('⏱ Tiempo agotado', 'auralis', 2200);
      this.ui.say('Oryn', 'Casi… ¡el santuario te deja intentarlo otra vez!');
      this.triggerCooldowns.set('desafio', 3);
      return;
    }
    this.ui.setObjective(`⏱ Desafío: <b>${Math.ceil(this.challengeTimer)} s</b> — alcanza el pedestal`);
  }

  /** Filas de Destellos para pausa/mapa/pantalla final. */
  private destelloRows() {
    const mapPos: Record<string, [number, number]> = {
      faro: [0, -165], coral: [-85, 80], oryn: [66, -22],
      quiries: [95, 35], cueva: [-79, -60], desafio: [-55, -95],
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

  // ------------------------------------------------------------------
  // Bucle principal
  // ------------------------------------------------------------------

  private loop = (): void => {
    this.rafId = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);

    if (this.state === 'cutscene') {
      this.cutscene.update(dt);
      this.player.updateIdleVisuals(dt);
      this.oryn.update(dt, this.player.position, this.player.facingY);
      this.liora.update(dt, this.player.position, this.destellos.count / this.destellos.required);
      this.elaria.update(dt);
    }
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
      if (!this.debugView) this.cameraCtrl.update(dt, this.player.position, this.player.velocity);
      this.sun.position.set(this.player.position.x + 60, this.player.position.y + 120, this.player.position.z + 40);
      this.sun.target.position.copy(this.player.position);
      this.sun.target.updateMatrixWorld();
      this.elaria.update(dt);
      this.updateInteractions(dt);
      this.updateCave();
      this.updateNotes();
      this.updateArena(dt);
      this.storyMoments();

      this.quiriTimer -= dt;
      if (this.quiriTimer <= 0) {
        this.audio.playQuiri();
        this.quiriTimer = 6 + Math.random() * 8;
      }
    }
    this.level.update(dt);
    this.effects.update(dt);
    this.vegetation.update(dt);
    this.atmosphere.update(dt);
    cloudTimeUniform.value = (cloudTimeUniform.value + dt) % 3600;

    this.updateAdaptiveQuality(dt);
    if (this.directRender) this.renderer.render(this.scene, this.cameraCtrl.camera);
    else this.composer.render();
  };

  /** Baja la calidad una vez si el framerate sostenido es bajo. */
  private updateAdaptiveQuality(dt: number): void {
    if (this.qualityLowered) return;
    // Solo medir durante gameplay: los tirones de carga/cutscene no cuentan
    if (this.state !== 'playing') return;
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
    if (!this.storyFlags.bruteSeen && p.x < -48 && p.z > 50) {
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
    this.voice.dispose();
    this.clearIntro();
    window.removeEventListener('resize', this.handleResize);
    this.audio.dispose();
    this.input.dispose();
    this.ui.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
