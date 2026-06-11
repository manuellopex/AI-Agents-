import type { Speaker } from './UIManager';

/** Perfil de voz por personaje: tono y velocidad le dan carácter. */
interface VoiceProfile {
  pitch: number;
  rate: number;
  /** false = el personaje no habla (Liora se comunica con luz). */
  speaks: boolean;
}

const PROFILES: Record<Speaker, VoiceProfile> = {
  Oryn: { pitch: 1.6, rate: 1.12, speaks: true },    // agudo y vivaz (cómico)
  Mael: { pitch: 1.0, rate: 1.04, speaks: true },    // joven, natural
  Elaria: { pitch: 0.85, rate: 0.9, speaks: true },  // serena y cálida
  'Quirí': { pitch: 1.9, rate: 1.18, speaks: true }, // casi un canto
  Liora: { pitch: 1.0, rate: 1.0, speaks: false },   // habla con luz, no con voz
};

/**
 * VoiceSystem
 * ------------
 * Narración por voz de los diálogos usando la síntesis de voz del propio
 * navegador (Web Speech API): gratuita, sin red y con voces en español
 * decentes en iOS/Android. Cada personaje tiene tono y ritmo propios.
 *
 * Diseñado como punto de intercambio: para voces premium pre-generadas
 * (ElevenLabs / edge-tts), basta con reemplazar el cuerpo de speak() por
 * la reproducción del MP3 correspondiente a la línea.
 */
export class VoiceSystem {
  /** Silencio elegido por el jugador (persistido). */
  muted = false;

  private voice: SpeechSynthesisVoice | null = null;
  private supported = false;

  constructor() {
    this.supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
    this.muted = typeof localStorage !== 'undefined' && localStorage.getItem('mo-voice-muted') === '1';
    if (!this.supported) return;
    // Las voces cargan de forma asíncrona en la mayoría de navegadores
    this.pickVoice();
    window.speechSynthesis.onvoiceschanged = () => this.pickVoice();
  }

  /** Elige la mejor voz en español disponible en el dispositivo. */
  private pickVoice(): void {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) return;
    // Preferencia: español neural/local → cualquier español → la primera
    const score = (v: SpeechSynthesisVoice): number => {
      let s = 0;
      if (v.lang.startsWith('es')) s += 10;
      if (/es-(ES|MX|US|419)/i.test(v.lang)) s += 2;
      if (v.localService) s += 1;
      if (/natural|neural|premium|enhanced/i.test(v.name)) s += 3;
      return s;
    };
    this.voice = voices.slice().sort((a, b) => score(b) - score(a))[0] ?? null;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    try {
      localStorage.setItem('mo-voice-muted', muted ? '1' : '0');
    } catch { /* almacenamiento no disponible: no pasa nada */ }
    if (muted) this.stop();
  }

  /** Narra una línea con la voz del personaje. Interrumpe la anterior. */
  speak(speaker: Speaker, text: string): void {
    if (!this.supported || this.muted) return;
    const profile = PROFILES[speaker];
    if (!profile?.speaks) return;

    // Limpiar símbolos que la síntesis leería raro (♪, ✦, emojis, comillas)
    const clean = text
      .replace(/[♪✦«»…]/g, ' ')
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!clean) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(clean);
    if (this.voice) utterance.voice = this.voice;
    utterance.lang = this.voice?.lang ?? 'es-ES';
    utterance.pitch = profile.pitch;
    utterance.rate = profile.rate;
    utterance.volume = 0.95;
    window.speechSynthesis.speak(utterance);
  }

  /** Corta la narración (pausa, muerte, cambio de pantalla). */
  stop(): void {
    if (this.supported) window.speechSynthesis.cancel();
  }

  dispose(): void {
    this.stop();
  }
}
