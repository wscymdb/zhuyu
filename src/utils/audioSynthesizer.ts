// 沉浸式东方意境 Web Audio 声音系统 (Hybrid Dual-Engine 2.0)
// 【小雨】：专属播放真实录音《细雨.mp3》（室外 20000Hz 全频无损直通 / 亭内 4500Hz 温润屋檐声学低通，流水静音）
// 【雷雨】：专属播放真实录音《thunder.mp3》（室外 20000Hz 全频直通 / 亭内 4500Hz 声学低通，只用该音源，流水与合成全静音，音画毫秒同步闪电）
// 【中雨】：专属播放真实录音 moderate-rain.mp3，沿用小雨的亭内外声学切换
// 【大雨 / 暴雨】：原版程序化物理声音合成（多阶粉红噪声雨 + 流水 + 随机檐滴 + 暴雨狂风微雷）
// 【悠远山雀】：深山悠远布谷鸟鸣 (cuckoo.mp3)，空气吸声低通滤波 + 空间声像定位 + 轻柔弱音，呈现空谷回声之感

import { RainType } from '../types';
import { useLoadingStore, rainAudioKey } from '../stores/useLoadingStore';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isInitialized = false;
  private isPlaying = false;
  private audioLoads = new Map<string, Promise<void>>();
  private backgroundLoad: Promise<void> | null = null;
  private cachedSynthRain: AudioBuffer | null = null;
  private cachedStream: AudioBuffer | null = null;

  // 1. 真实录音音轨 (小雨模式专属使用 rain.mp3)
  private realRainBuffer: AudioBuffer | null = null;
  private moderateRainBuffer: AudioBuffer | null = null;
  private realRainSource: AudioBufferSourceNode | null = null;
  private realRainGainNode: GainNode | null = null;
  private realRainFilterNode: BiquadFilterNode | null = null;

  // 2. 真实雷雨音轨 (雷雨模式专属使用 thunder.mp3 循环播放)
  private thunderBuffer: AudioBuffer | null = null;
  private thunderSource: AudioBufferSourceNode | null = null;
  private thunderGainNode: GainNode | null = null;
  private thunderFilterNode: BiquadFilterNode | null = null;
  private thunderLoopInterval: number | null = null;
  private thunderFlashTimers: number[] = [];

  // 闪电与惊雷视觉回调 (用于驱动 3D 闪电光照与天空高亮)
  public onLightning: ((intensity: number) => void) | null = null;

  // 3. 原版程序化雨声音轨 (中雨 / 大雨 / 暴雨，以及小雨/雷雨加载完成前的无缝保底)
  private synthRainSource: AudioBufferSourceNode | null = null;
  private synthRainGainNode: GainNode | null = null;
  private synthRainFilterNode: BiquadFilterNode | null = null;

  // 4. 原版程序化流水声音轨
  private streamSource: AudioBufferSourceNode | null = null;
  private streamGainNode: GainNode | null = null;

  // 5. 悠远深山布谷鸟鸣 (cuckoo.mp3) 与动物鸣叫扩展
  private cuckooBuffer: AudioBuffer | null = null;
  private currentCuckooSource: AudioBufferSourceNode | null = null;
  private currentCuckooGain: GainNode | null = null;
  private cuckooTimer: number | null = null;
  private currentAnimalSound: string = 'cuckoo';
  private animalVolume: number = 0.45; // 动物鸣叫专属音量 (0.0 ~ 1.0)

  // 6. 原版檐角滴水随机定时器
  private dripTimeout: number | null = null;

  // 停止延时定时器引用（防止快速切换时的竞态停音 bug）
  private stopTimer: number | null = null;

  // 全局主音量控制
  private masterGain: GainNode | null = null;
  private currentMasterVolume = 0.85;

  // 状态追踪
  private isInPavilion = false;
  private currentRainType: RainType = 'light';

  // 古琴音阶频率 (宫 商 角 徵 羽: C4, D4, E4, G4, A4, C5, D5)
  private pentatonicFreqs = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33];

  public init() {
    if (this.isInitialized && this.ctx) return;
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioContextClass();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.currentMasterVolume, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    this.isInitialized = true;

  }

  private loadAudio(url: string, install: (buffer: AudioBuffer) => void): Promise<void> {
    const pending = this.audioLoads.get(url);
    if (pending) return pending;
    const job = (async () => {
      useLoadingStore.getState().setAudio(url, 'loading');
      this.init();
      if (!this.ctx) throw new Error('浏览器无法初始化声音');
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
      const bytes = await response.arrayBuffer();
      useLoadingStore.getState().setAudio(url, 'decoding');
      const buffer = await this.ctx.decodeAudioData(bytes);
      install(buffer);
      useLoadingStore.getState().setAudio(url, 'ready');
    })().catch(error => {
      const message = error instanceof Error ? error.message : String(error);
      useLoadingStore.getState().setAudio(url, 'error', message);
      throw error;
    }).finally(() => { this.audioLoads.delete(url); });
    this.audioLoads.set(url, job);
    return job;
  }

  public preloadRealAudio(): Promise<void> {
    if (this.realRainBuffer) { useLoadingStore.getState().setAudio('/audio/rain.mp3','ready'); return Promise.resolve(); }
    return this.loadAudio('/audio/rain.mp3', buffer => {
      this.realRainBuffer = buffer;
      if (this.isPlaying && this.currentRainType === 'light') { this.setupRealRainSource(); this.updateAcoustics(0.4); }
    });
  }

  public preloadModerateAudio(): Promise<void> {
    if (this.moderateRainBuffer) { useLoadingStore.getState().setAudio('/audio/moderate-rain.mp3','ready'); return Promise.resolve(); }
    return this.loadAudio('/audio/moderate-rain.mp3', buffer => {
      this.moderateRainBuffer = buffer;
      if (this.isPlaying && this.currentRainType === 'moderate') { this.setupRealRainSource(); this.updateAcoustics(0.4); }
    });
  }

  private getSelectedRainBuffer() {
    if (this.currentRainType === 'light') return this.realRainBuffer;
    if (this.currentRainType === 'moderate') return this.moderateRainBuffer;
    return null;
  }

  public preloadThunderAudio(): Promise<void> {
    if (this.thunderBuffer) { useLoadingStore.getState().setAudio('/audio/thunder.mp3','ready'); return Promise.resolve(); }
    return this.loadAudio('/audio/thunder.mp3', buffer => {
      this.thunderBuffer = buffer;
      if (this.isPlaying && this.currentRainType === 'thunder') { this.setupThunderSource(); this.updateAcoustics(0.4); }
    });
  }

  public preloadCuckooAudio(): Promise<void> {
    if (this.cuckooBuffer) return Promise.resolve();
    return this.loadAudio('/audio/cuckoo.mp3', buffer => { this.cuckooBuffer = buffer; });
  }

  public async prepareRainAudio(rain: RainType): Promise<void> {
    if (rain === 'light') return this.preloadRealAudio();
    if (rain === 'moderate') return this.preloadModerateAudio();
    if (rain === 'thunder') return this.preloadThunderAudio();
    const key = rainAudioKey(rain);
    try {
      useLoadingStore.getState().setAudio(key, 'loading');
      this.init();
      if (!this.createSynthRainBuffer() || !this.createStreamBuffer()) throw new Error('浏览器无法准备雨声');
      useLoadingStore.getState().setAudio(key, 'ready');
    } catch (error) {
      useLoadingStore.getState().setAudio(key, 'error', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  // Other rain recordings and birds do not hold up the first entry. Load them
  // sequentially after entry, sharing any request already started by a switch.
  public preloadBackgroundAudio(): Promise<void> {
    if (this.backgroundLoad) return this.backgroundLoad;
    this.backgroundLoad = (async () => {
      for (const load of [() => this.preloadRealAudio(), () => this.preloadModerateAudio(),
        () => this.preloadThunderAudio(), () => this.preloadCuckooAudio()]) {
        await load().catch(() => { /* Per-file error remains visible in loading state. */ });
      }
    })();
    return this.backgroundLoad;
  }

  public isAudioRunning() { return this.isPlaying && this.ctx?.state === 'running'; }

  // 启动沉浸式环境音
  public async startAmbience() {
    this.init();
    if (!this.ctx) return;

    // 清除可能存在的旧停播延时定时器，杜绝停音后立即重开导致静音的 bug
    if (this.stopTimer !== null) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }

    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch (err) {
        console.warn('AudioContext resume failed:', err);
      }
    }

    this.isPlaying = true;
    this.restartLoopers();
    this.startRandomDrips();
    this.startCuckooScheduler();
    void this.preloadBackgroundAudio();
  }

  // 停止环境音
  public stopAmbience() {
    if (!this.ctx || !this.isPlaying) return;
    this.isPlaying = false;

    // 清除滴水定时器
    if (this.dripTimeout !== null) {
      clearTimeout(this.dripTimeout);
      this.dripTimeout = null;
    }

    // 清除布谷鸟调度定时器
    if (this.cuckooTimer !== null) {
      clearTimeout(this.cuckooTimer);
      this.cuckooTimer = null;
    }

    // 清除雷鸣闪电循环
    this.clearThunderLightningTimers();

    const now = this.ctx.currentTime;
    if (this.realRainGainNode) {
      this.realRainGainNode.gain.linearRampToValueAtTime(0.0001, now + 0.3);
    }
    if (this.thunderGainNode) {
      this.thunderGainNode.gain.linearRampToValueAtTime(0.0001, now + 0.3);
    }
    if (this.synthRainGainNode) {
      this.synthRainGainNode.gain.linearRampToValueAtTime(0.0001, now + 0.3);
    }
    if (this.streamGainNode) {
      this.streamGainNode.gain.linearRampToValueAtTime(0.0001, now + 0.3);
    }
    if (this.currentCuckooGain) {
      this.currentCuckooGain.gain.linearRampToValueAtTime(0.0001, now + 0.3);
    }

    if (this.stopTimer !== null) {
      clearTimeout(this.stopTimer);
    }
    this.stopTimer = window.setTimeout(() => {
      this.stopAllSources();
      this.stopTimer = null;
    }, 350);
  }

  private stopAllSources() {
    if (this.realRainSource) {
      try {
        this.realRainSource.stop();
        this.realRainSource.disconnect();
      } catch {}
      this.realRainSource = null;
      this.realRainGainNode = null;
      this.realRainFilterNode = null;
    }
    if (this.thunderSource) {
      try {
        this.thunderSource.stop();
        this.thunderSource.disconnect();
      } catch {}
      this.thunderSource = null;
      this.thunderGainNode = null;
      this.thunderFilterNode = null;
    }
    this.clearThunderLightningTimers();

    if (this.synthRainSource) {
      try {
        this.synthRainSource.stop();
        this.synthRainSource.disconnect();
      } catch {}
      this.synthRainSource = null;
      this.synthRainGainNode = null;
      this.synthRainFilterNode = null;
    }
    if (this.streamSource) {
      try {
        this.streamSource.stop();
        this.streamSource.disconnect();
      } catch {}
      this.streamSource = null;
      this.streamGainNode = null;
    }
    if (this.currentCuckooSource) {
      try {
        this.currentCuckooSource.stop();
        this.currentCuckooSource.disconnect();
      } catch {}
      this.currentCuckooSource = null;
      this.currentCuckooGain = null;
    }
  }

  // 生成程序化粉红噪声缓冲
  private createSynthRainBuffer(): AudioBuffer | null {
    if (this.cachedSynthRain) return this.cachedSynthRain;
    if (!this.ctx) return null;
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.76160 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    this.cachedSynthRain = buffer;
    return buffer;
  }

  // 生成流水白噪缓冲
  private createStreamBuffer(): AudioBuffer | null {
    if (this.cachedStream) return this.cachedStream;
    if (!this.ctx) return null;
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.07;
    }
    this.cachedStream = buffer;
    return buffer;
  }

  // 装配当前小雨或中雨的真实录音音轨
  private setupRealRainSource() {
    if (!this.ctx || !this.masterGain) return;
    const buffer = this.getSelectedRainBuffer();
    if (this.realRainSource) {
      try {
        this.realRainSource.stop();
        this.realRainSource.disconnect();
      } catch {}
    }

    this.realRainFilterNode?.disconnect();
    this.realRainGainNode?.disconnect();
    this.realRainSource = null;
    this.realRainFilterNode = null;
    this.realRainGainNode = null;
    if (!buffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    // 室外 20000Hz (全频直通，零滤波损耗)；室内 4500Hz (温润屋檐声学低通，保留细雨清晰声)
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(this.isInPavilion ? 4500 : 20000, now);
    filter.Q.setValueAtTime(0.707, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    src.start(0);
    this.realRainSource = src;
    this.realRainFilterNode = filter;
    this.realRainGainNode = gain;
  }

  // 装配真实雷雨录音音轨节点 (【雷雨】专用，循环播放 thunder.mp3)
  private setupThunderSource() {
    if (!this.ctx || !this.masterGain || !this.thunderBuffer) return;
    if (this.thunderSource) {
      try {
        this.thunderSource.stop();
        this.thunderSource.disconnect();
      } catch {}
    }

    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.thunderBuffer;
    src.loop = true;

    // 室外 20000Hz 全频无损直通；室内 4500Hz 温润屋檐低通
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(this.isInPavilion ? 4500 : 20000, now);
    filter.Q.setValueAtTime(0.707, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    src.start(0);
    this.thunderSource = src;
    this.thunderFilterNode = filter;
    this.thunderGainNode = gain;

    // 启动与循环音频波形完全契合的闪电闪烁循环
    if (this.currentRainType === 'thunder') {
      this.startThunderLightningLoop();
    }
  }

  // 启动雷雨闪电循环 (thunder.mp3 时长约 30.26s，波形峰值：0.8s 主爆、7.0s 次爆、10.2s 滚雷)
  private startThunderLightningLoop() {
    this.clearThunderLightningTimers();
    if (!this.isPlaying || this.currentRainType !== 'thunder' || !this.thunderBuffer) return;

    const loopMs = (this.thunderBuffer.duration || 30.26) * 1000;

    const triggerCycle = () => {
      // 1. 0.72s 主闪电 (两段耀眼暴闪)
      const t1_pre = window.setTimeout(() => this.onLightning?.(0.65), 620);
      const t1_main = window.setTimeout(() => this.onLightning?.(1.0), 730);
      const t1_re = window.setTimeout(() => this.onLightning?.(0.55), 860);

      // 2. 6.9s 第二道炸雷闪电
      const t2 = window.setTimeout(() => this.onLightning?.(0.78), 6900);

      // 3. 10.2s 第三道滚雷闪电
      const t3 = window.setTimeout(() => this.onLightning?.(0.42), 10200);

      this.thunderFlashTimers.push(t1_pre, t1_main, t1_re, t2, t3);
    };

    // 立即执行本轮循环的闪电联动
    triggerCycle();

    // 随后每隔 loopMs 周期性与音频同步触发
    this.thunderLoopInterval = window.setInterval(() => {
      if (!this.isPlaying || this.currentRainType !== 'thunder') {
        this.clearThunderLightningTimers();
        return;
      }
      triggerCycle();
    }, loopMs);
  }

  private clearThunderLightningTimers() {
    if (this.thunderLoopInterval !== null) {
      clearInterval(this.thunderLoopInterval);
      this.thunderLoopInterval = null;
    }
    this.thunderFlashTimers.forEach((t) => clearTimeout(t));
    this.thunderFlashTimers = [];
  }

  // 启动或重启无缝循环音轨
  private restartLoopers() {
    if (!this.ctx || !this.masterGain || !this.isPlaying) return;

    if (this.stopTimer !== null) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }

    this.stopAllSources();
    const now = this.ctx.currentTime;

    // 1. 当前小雨或中雨的真实录音音轨
    if (this.getSelectedRainBuffer()) {
      this.setupRealRainSource();
    }

    // 2. 真实雷雨音轨（【雷雨】专属）
    if (this.thunderBuffer) {
      this.setupThunderSource();
    }

    // 3. 原版程序化雨声音轨（用于大雨、暴雨，以及真实录音加载未完成时的防静音无缝保底）
    const synthRainBuf = this.createSynthRainBuffer();
    if (synthRainBuf) {
      const src = this.ctx.createBufferSource();
      src.buffer = synthRainBuf;
      src.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(this.isInPavilion ? 1400 : 3400, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      src.start(0);
      this.synthRainSource = src;
      this.synthRainFilterNode = filter;
      this.synthRainGainNode = gain;
    }

    // 4. 原版程序化小溪流水音轨
    const streamBuf = this.createStreamBuffer();
    if (streamBuf) {
      const src = this.ctx.createBufferSource();
      src.buffer = streamBuf;
      src.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(800, now);
      filter.Q.setValueAtTime(1.5, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      src.start(0);
      this.streamSource = src;
      this.streamGainNode = gain;
    }

    // 应用当前雨势与空间的动态声学平衡
    this.updateAcoustics(0.5);
  }

  /**
   * 核心声学逻辑：
   * 1. 小雨 (light) / 中雨 (moderate)：
   *    - 分别播放 rain.mp3 / moderate-rain.mp3
   *    - 非亭内（室外）：20,000Hz 全频无损直通，1.0 满格音量，流水静音
   *    - 亭内：4500Hz 温润屋檐声学低通，0.88 音量，清晰可闻
   * 2. 雷雨 (thunder)：
   *    - 专属播放用户真实录音《thunder.mp3》（只用该音源！）
   *    - 流水与合成雨声全静音，零多余杂噪干扰
   *    - 非亭内（室外）：20,000Hz 全频无损直通，1.0 满格音量
   *    - 亭内：4500Hz 声学低通，0.88 音量，厚重清雅
   * 3. 大雨 (heavy) / 暴雨 (storm)：
   *    - 保持原版多阶程序化物理雨声 + 流水 + 随机檐滴
   */
  private updateAcoustics(rampDuration = 0.5) {
    if (!this.ctx || !this.isPlaying) return;
    const now = this.ctx.currentTime;

    const isRecordedRainMode = this.currentRainType === 'light' || this.currentRainType === 'moderate';
    const isThunderMode = this.currentRainType === 'thunder';

    if (isRecordedRainMode) {
      // 小雨、中雨各自播放对应的真实录音
      if (this.thunderGainNode) {
        this.thunderGainNode.gain.linearRampToValueAtTime(0.0001, now + rampDuration);
      }

      this.streamGainNode?.gain.linearRampToValueAtTime(0.0001, now + rampDuration);
      const buffer = this.getSelectedRainBuffer();
      const hasRealAudio = !!buffer && this.realRainSource?.buffer === buffer && !!this.realRainGainNode;
      if (hasRealAudio) {
        if (this.realRainFilterNode) {
          this.realRainFilterNode.frequency.linearRampToValueAtTime(
            this.isInPavilion ? 4500 : 20000,
            now + rampDuration
          );
        }
        if (this.realRainGainNode) {
          this.realRainGainNode.gain.linearRampToValueAtTime(
            this.isInPavilion ? 0.88 : 1.0,
            now + rampDuration
          );
        }
        if (this.synthRainGainNode) {
          this.synthRainGainNode.gain.linearRampToValueAtTime(0.0001, now + rampDuration);
        }
        if (this.streamGainNode) {
          this.streamGainNode.gain.linearRampToValueAtTime(0.0001, now + rampDuration);
        }
      } else {
        if (this.synthRainFilterNode) {
          this.synthRainFilterNode.frequency.linearRampToValueAtTime(
            this.currentRainType === 'moderate' ? (this.isInPavilion ? 1400 : 3400) : (this.isInPavilion ? 1800 : 2800),
            now + rampDuration
          );
        }
        if (this.synthRainGainNode) {
          this.synthRainGainNode.gain.linearRampToValueAtTime(
            this.currentRainType === 'moderate' ? (this.isInPavilion ? 0.38 : 0.50) : (this.isInPavilion ? 0.30 : 0.38),
            now + rampDuration
          );
        }
      }
    } else if (isThunderMode) {
      // ===== 【雷雨模式】：专属播放用户录音《thunder.mp3》（只用该音源！） =====
      if (this.realRainGainNode) {
        this.realRainGainNode.gain.linearRampToValueAtTime(0.0001, now + rampDuration);
      }

      const hasThunderAudio = !!this.thunderBuffer && !!this.thunderGainNode;
      if (hasThunderAudio) {
        if (this.thunderFilterNode) {
          this.thunderFilterNode.frequency.linearRampToValueAtTime(
            this.isInPavilion ? 4500 : 20000,
            now + rampDuration
          );
        }
        if (this.thunderGainNode) {
          this.thunderGainNode.gain.linearRampToValueAtTime(
            this.isInPavilion ? 0.88 : 1.0,
            now + rampDuration
          );
        }
        // 完全静音程序化雨声与溪流水声，保证只听用户原声音轨！
        if (this.synthRainGainNode) {
          this.synthRainGainNode.gain.linearRampToValueAtTime(0.0001, now + rampDuration);
        }
        if (this.streamGainNode) {
          this.streamGainNode.gain.linearRampToValueAtTime(0.0001, now + rampDuration);
        }
      } else {
        // 未完成解码时的无缝保底
        if (this.synthRainFilterNode) {
          this.synthRainFilterNode.frequency.linearRampToValueAtTime(
            this.isInPavilion ? 1800 : 3800,
            now + rampDuration
          );
        }
        if (this.synthRainGainNode) {
          this.synthRainGainNode.gain.linearRampToValueAtTime(
            this.isInPavilion ? 0.40 : 0.60,
            now + rampDuration
          );
        }
      }
    } else {
      // ===== 【中雨 / 大雨 / 暴雨】：多阶程序化物理声音合成 =====
      if (this.realRainGainNode) {
        this.realRainGainNode.gain.linearRampToValueAtTime(0.0001, now + rampDuration);
      }
      if (this.thunderGainNode) {
        this.thunderGainNode.gain.linearRampToValueAtTime(0.0001, now + rampDuration);
      }

      // 梯度声学参数表
      const profiles: Record<
        'moderate' | 'heavy' | 'storm',
        {
          outdoorFreq: number;
          indoorFreq: number;
          outdoorVol: number;
          indoorVol: number;
          streamVol: number;
        }
      > = {
        moderate: {
          outdoorFreq: 3400,
          indoorFreq: 1400,
          outdoorVol: 0.50,
          indoorVol: 0.38,
          streamVol: 0.22,
        },
        heavy: {
          outdoorFreq: 4400,
          indoorFreq: 1800,
          outdoorVol: 0.75,
          indoorVol: 0.55,
          streamVol: 0.32,
        },
        storm: {
          outdoorFreq: 5800,
          indoorFreq: 2200,
          outdoorVol: 0.95,
          indoorVol: 0.70,
          streamVol: 0.42,
        },
      };

      const profile =
        profiles[this.currentRainType as 'moderate' | 'heavy' | 'storm'] || profiles.moderate;

      if (this.synthRainFilterNode) {
        this.synthRainFilterNode.frequency.linearRampToValueAtTime(
          this.isInPavilion ? profile.indoorFreq : profile.outdoorFreq,
          now + rampDuration
        );
      }
      if (this.synthRainGainNode) {
        const targetVol = this.isInPavilion ? profile.indoorVol : profile.outdoorVol;
        this.synthRainGainNode.gain.linearRampToValueAtTime(targetVol, now + rampDuration);
      }
      if (this.streamGainNode) {
        const targetStream = this.isInPavilion ? profile.streamVol * 0.6 : profile.streamVol;
        this.streamGainNode.gain.linearRampToValueAtTime(targetStream, now + rampDuration);
      }
    }
  }

  // 随机檐角水滴 (小雨、中雨与雷雨模式自带真实完整录音，不叠加额外程序化檐滴)
  private startRandomDrips() {
    if (this.dripTimeout !== null) {
      clearTimeout(this.dripTimeout);
      this.dripTimeout = null;
    }

    const trigger = () => {
      if (!this.isPlaying) return;
      if (this.currentRainType !== 'light' && this.currentRainType !== 'moderate' && this.currentRainType !== 'thunder') {
        this.playWaterDrip();
      }
      const intervals: Record<RainType, [number, number]> = {
        light: [3000, 5000],
        moderate: [1200, 2600],
        heavy: [600, 1400],
        storm: [250, 600],
        thunder: [180, 450],
      };
      const [minDelay, maxDelay] = intervals[this.currentRainType] || [1200, 2600];
      const nextDelay = minDelay + Math.random() * (maxDelay - minDelay);
      this.dripTimeout = window.setTimeout(trigger, nextDelay);
    };
    this.dripTimeout = window.setTimeout(trigger, 1200);
  }

  // 播放一次悠远深山的布谷鸟啼鸣 (暴雨与雷雨天隐巢不鸣)
  public playDistantCuckoo() {
    if (!this.ctx || !this.masterGain || !this.isPlaying || !this.cuckooBuffer) return;

    if (this.currentRainType === 'storm' || this.currentRainType === 'thunder') return;
    if (this.currentAnimalSound !== 'cuckoo' || this.animalVolume <= 0.001) return;

    if (this.currentCuckooSource) {
      try {
        this.currentCuckooSource.stop();
        this.currentCuckooSource.disconnect();
      } catch {}
      this.currentCuckooSource = null;
      this.currentCuckooGain = null;
    }

    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.cuckooBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    const cutoffFreq = this.isInPavilion ? 2000 : 2800;
    filter.frequency.setValueAtTime(cutoffFreq, now);
    filter.Q.setValueAtTime(0.707, now);

    let panner: StereoPannerNode | null = null;
    if (typeof this.ctx.createStereoPanner === 'function') {
      try {
        panner = this.ctx.createStereoPanner();
        const panDir = Math.random() > 0.5 ? 1 : -1;
        const panVal = panDir * (0.35 + Math.random() * 0.25);
        panner.pan.setValueAtTime(panVal, now);
      } catch {}
    }

    const baseVol = (this.isInPavilion ? 0.11 : 0.16) * this.animalVolume;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(baseVol, now + 0.8);

    const callCount = Math.random() > 0.4 ? 2 : 1;
    const callDuration = callCount === 1 ? 3.0 : 4.8;
    gain.gain.setValueAtTime(baseVol, now + callDuration - 1.2);
    gain.gain.linearRampToValueAtTime(0.0001, now + callDuration);

    if (panner) {
      src.connect(filter);
      filter.connect(panner);
      panner.connect(gain);
    } else {
      src.connect(filter);
      filter.connect(gain);
    }
    gain.connect(this.masterGain);

    src.start(now);
    src.stop(now + callDuration + 0.1);
    this.currentCuckooSource = src;
    this.currentCuckooGain = gain;

    src.onended = () => {
      if (this.currentCuckooSource === src) {
        this.currentCuckooSource = null;
        this.currentCuckooGain = null;
      }
    };
  }

  // 调度悠远布谷鸟啼鸣循环
  private startCuckooScheduler() {
    if (this.cuckooTimer !== null) {
      clearTimeout(this.cuckooTimer);
      this.cuckooTimer = null;
    }

    const scheduleNext = (minMs: number, maxMs: number) => {
      const delay = minMs + Math.random() * (maxMs - minMs);
      this.cuckooTimer = window.setTimeout(() => {
        if (!this.isPlaying) return;
        this.playDistantCuckoo();
        scheduleNext(70000, 150000);
      }, delay);
    };

    scheduleNext(20000, 35000);
  }

  // 切换动物鸣叫种类
  public setAnimalSound(sound: string) {
    if (this.currentAnimalSound === sound) return;
    this.currentAnimalSound = sound;
    if (sound === 'none' && this.currentCuckooSource) {
      try {
        this.currentCuckooSource.stop();
        this.currentCuckooSource.disconnect();
      } catch {}
      this.currentCuckooSource = null;
      this.currentCuckooGain = null;
    }
  }

  // 调节动物鸣叫独立音量 (0.0 ~ 1.0)
  public setAnimalVolume(vol: number) {
    this.animalVolume = Math.max(0, Math.min(1, vol));
    if (this.currentCuckooGain && this.ctx) {
      const baseVol = (this.isInPavilion ? 0.11 : 0.16) * this.animalVolume;
      this.currentCuckooGain.gain.linearRampToValueAtTime(
        Math.max(0.0001, baseVol),
        this.ctx.currentTime + 0.1
      );
    }
  }

  // 进出听雨亭声学切换
  public setInPavilion(inPavilion: boolean) {
    if (this.isInPavilion === inPavilion) return;
    this.isInPavilion = inPavilion;
    this.updateAcoustics(0.6);
  }

  // 切换雨势等级（小雨 / 中雨 / 大雨 / 暴雨 / 雷雨）
  public setRainType(type: RainType) {
    this.currentRainType = type;
    if (this.isPlaying) void this.prepareRainAudio(type).catch(() => { /* Keep the existing synthetic fallback. */ });
    if (this.isPlaying && (type === 'light' || type === 'moderate') &&
        this.realRainSource?.buffer !== this.getSelectedRainBuffer()) {
      this.setupRealRainSource();
    }
    this.updateAcoustics(0.5);

    if (type === 'thunder') {
      if (this.isPlaying) {
        if (this.thunderBuffer && !this.thunderSource) {
          this.setupThunderSource();
          this.updateAcoustics(0.3);
        } else if (this.thunderSource) {
          this.startThunderLightningLoop();
        }
      }
    } else {
      this.clearThunderLightningTimers();
    }
  }

  // 兼容老调用
  public setWeatherIntensity(type: any) {
    if (type === 'dusk' || type === 'night') {
      this.setRainType('moderate');
    } else {
      this.setRainType(type as RainType);
    }
  }

  // 播放单次檐滴声
  public playWaterDrip() {
    if (!this.ctx || !this.masterGain || !this.isPlaying) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const startFreq = 1600 + Math.random() * 800;
    const endFreq = 400 + Math.random() * 200;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.08);

    const baseVol = this.isInPavilion ? 0.08 : 0.04;
    gain.gain.setValueAtTime(baseVol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  // 拨动案头古琴琴弦
  public playGuqinString(noteIndex?: number) {
    this.init();
    if (!this.ctx || !this.masterGain) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    const now = this.ctx.currentTime;
    const idx =
      typeof noteIndex === 'number'
        ? noteIndex % this.pentatonicFreqs.length
        : Math.floor(Math.random() * this.pentatonicFreqs.length);
    const fundamental = this.pentatonicFreqs[idx];

    // 双泛音振荡器模拟丝弦余韵
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(fundamental, now);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(fundamental * 2.01, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.frequency.exponentialRampToValueAtTime(350, now + 2.8);

    gain.gain.setValueAtTime(0.38, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.2);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 3.3);
    osc2.stop(now + 3.3);
  }

  // 调节全局主音量
  public setMasterVolume(vol: number) {
    this.currentMasterVolume = Math.max(0, Math.min(1, vol));
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.linearRampToValueAtTime(
        this.currentMasterVolume,
        this.ctx.currentTime + 0.1
      );
    }
  }
}

export const soundEngine = new SoundEngine();
