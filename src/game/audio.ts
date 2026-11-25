/**
 * 結合使用者原始 BGM (public/bgm/map_01.mp3) 與 Web Audio 程式合成音效
 */
class AudioEngine {
  private bgm: HTMLAudioElement | null = null;
  private bgmAvailable = false;
  private bgmWantPlay = false;
  private customObjectUrl: string | null = null;
  private ctx: AudioContext | null = null;

  public muted = false;
  public bgmVolume = 0.45;
  public bgmTrackName = 'map_01.mp3';

  constructor() {
    try {
      this.muted = localStorage.getItem('maze-muted') === '1';
    } catch {
      this.muted = false;
    }
    this.loadBgmUrl('/bgm/map_01.mp3', 'map_01.mp3');
  }

  public loadBgmUrl(url: string, label: string) {
    if (this.bgm) {
      this.bgm.pause();
      this.bgm.src = '';
    }
    this.bgmAvailable = false;
    this.bgmTrackName = label;

    const audio = new Audio();
    audio.loop = true;
    audio.volume = this.muted ? 0 : this.bgmVolume;
    audio.addEventListener('error', () => {
      this.bgmAvailable = false;
    });
    audio.addEventListener('canplaythrough', () => {
      this.bgmAvailable = true;
      if (this.bgmWantPlay && !this.muted) {
        audio.play().catch(() => {});
      }
    });
    audio.src = url;
    this.bgm = audio;
  }

  public loadCustomBgmFile(file: File) {
    if (this.customObjectUrl) {
      URL.revokeObjectURL(this.customObjectUrl);
    }
    this.customObjectUrl = URL.createObjectURL(file);
    this.bgmWantPlay = true;
    this.loadBgmUrl(this.customObjectUrl, file.name);
    if (!this.muted && this.bgm) {
      this.bgm.play().catch(() => {});
    }
  }

  public startBgm() {
    this.bgmWantPlay = true;
    if (this.bgm && this.bgmAvailable && !this.muted && this.bgm.paused) {
      this.bgm.play().catch(() => {});
    }
  }

  public setMuted(mute: boolean) {
    this.muted = mute;
    try {
      localStorage.setItem('maze-muted', mute ? '1' : '0');
    } catch {
      // ignore
    }
    if (this.bgm) {
      this.bgm.volume = mute ? 0 : this.bgmVolume;
      if (mute) {
        this.bgm.pause();
      } else if (this.bgmWantPlay && this.bgmAvailable) {
        this.bgm.play().catch(() => {});
      }
    }
  }

  private getCtx(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public playStep() {
    const ctx = this.getCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(115 + Math.random() * 18, t);
    osc.frequency.exponentialRampToValueAtTime(48, t + 0.065);
    gain.gain.setValueAtTime(0.075, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.075);
  }

  public playTurn() {
    const ctx = this.getCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(190, t);
    osc.frequency.exponentialRampToValueAtTime(130, t + 0.045);
    gain.gain.setValueAtTime(0.03, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.055);
  }

  public playBump() {
    const ctx = this.getCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(82, t);
    osc.frequency.exponentialRampToValueAtTime(34, t + 0.1);
    gain.gain.setValueAtTime(0.11, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  public playAltarLit(litCount: number) {
    const ctx = this.getCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    const base = 392 * Math.pow(1.06, Math.min(litCount, 8));
    [1, 1.25, 1.5, 2].forEach((mult, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(base * mult, t + i * 0.055);
      gain.gain.setValueAtTime(0.001, t + i * 0.055);
      gain.gain.linearRampToValueAtTime(0.07, t + i * 0.055 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0008, t + i * 0.055 + 0.6);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t + i * 0.055);
      osc.stop(t + i * 0.055 + 0.65);
    });
  }

  public playMonsterHit() {
    const ctx = this.getCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(62, t + 0.24);
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.28);
  }

  public playSealed() {
    const ctx = this.getCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    [140, 105].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + i * 0.11);
      gain.gain.setValueAtTime(0.08, t + i * 0.11);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.11 + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t + i * 0.11);
      osc.stop(t + i * 0.11 + 0.2);
    });
  }

  public playVictory() {
    const ctx = this.getCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + i * 0.09);
      gain.gain.setValueAtTime(0.08, t + i * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.0008, t + i * 0.09 + 0.75);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t + i * 0.09);
      osc.stop(t + i * 0.09 + 0.8);
    });
  }
}

export const audioEngine = new AudioEngine();
