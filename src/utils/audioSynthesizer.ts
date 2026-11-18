// 沉浸式东方意境 Web Audio 程序化声音合成器 (Procedural Audio Engine)
// 零外部资源依赖，纯原生 Web Audio API 合成真实雨声、流水声、檐角滴水声与五声古琴

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isInitialized = false;
  private isPlaying = false;

  // 雨声音轨
  private rainSource: AudioBufferSourceNode | null = null;
  private rainGainNode: GainNode | null = null;
  private rainFilterNode: BiquadFilterNode | null = null;

  // 溪流流水音轨
  private streamSource: AudioBufferSourceNode | null = null;
  private streamGainNode: GainNode | null = null;

  // 滴水定时器
  private dripTimeout: number | null = null;

  // 主音量
  private masterGain: GainNode | null = null;

  // 古琴音阶频率 (宫 商 角 徵 羽: C4, D4, E4, G4, A4, C5, D5)
  private pentatonicFreqs = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33];

  public init() {
    if (this.isInitialized) return;
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioContextClass();
    
    // 主增益节点
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    this.isInitialized = true;
  }

  // 启动沉浸式环境音
  public async startAmbience() {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    if (this.isPlaying) return;

    this.isPlaying = true;
    this.startRainSynth();
    this.startStreamSynth();
    this.startRandomDrips();
  }

  public stopAmbience() {
    if (!this.ctx || !this.isPlaying) return;
    this.isPlaying = false;

    // 1. 彻底清除滴水递归定时器，防止孤儿定时器常驻泄漏
    if (this.dripTimeout !== null) {
      clearTimeout(this.dripTimeout);
      this.dripTimeout = null;
    }

    // 2. 优雅淡出并在 300ms 后真正停止并断开雨声节点 (防止背景常驻计算与内存泄漏)
    if (this.rainSource) {
      const src = this.rainSource;
      if (this.rainGainNode) {
        this.rainGainNode.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.3);
      }
      setTimeout(() => {
        try {
          src.stop();
          src.disconnect();
        } catch {}
      }, 350);
      this.rainSource = null;
    }

    // 3. 优雅淡出并停止流水声节点
    if (this.streamSource) {
      const src = this.streamSource;
      if (this.streamGainNode) {
        this.streamGainNode.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.3);
      }
      setTimeout(() => {
        try {
          src.stop();
          src.disconnect();
        } catch {}
      }, 350);
      this.streamSource = null;
    }
  }

  // 1. 程序化粉红噪声/雨声合成
  private startRainSynth() {
    if (!this.ctx || !this.masterGain) return;

    // 若此前已有雨声音源，先安全停用并断开
    if (this.rainSource) {
      try {
        this.rainSource.stop();
        this.rainSource.disconnect();
      } catch {}
      this.rainSource = null;
    }
    
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // 生成粉红噪声算法 (1/f 噪声，最贴合自然雨声)
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = buffer;
    noiseSource.loop = true;
    this.rainSource = noiseSource;

    // 带通滤波形成细雨朦胧感
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3200, this.ctx.currentTime);
    this.rainFilterNode = filter;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    this.rainGainNode = gain;

    noiseSource.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noiseSource.start();
  }

  // 2. 小溪流水声合成 (低频湍流起伏)
  private startStreamSynth() {
    if (!this.ctx || !this.masterGain) return;

    if (this.streamSource) {
      try {
        this.streamSource.stop();
        this.streamSource.disconnect();
      } catch {}
      this.streamSource = null;
    }

    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.08;
    }

    const streamSource = this.ctx.createBufferSource();
    streamSource.buffer = buffer;
    streamSource.loop = true;
    this.streamSource = streamSource;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, this.ctx.currentTime);
    filter.Q.setValueAtTime(1.5, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    this.streamGainNode = gain;

    streamSource.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    streamSource.start();
  }

  // 3. 檐角滴水音效 (随机正弦瞬态)
  public playWaterDrip() {
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // 基础频率 1200Hz - 2200Hz
    const baseFreq = 1200 + Math.random() * 900;
    const now = this.ctx.currentTime;

    osc.type = 'sine';
    // 快速上滑频制造水滴击打石面或水潭的“滴答”音
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.6, now + 0.08);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.2);
  }

  private startRandomDrips() {
    if (this.dripTimeout !== null) {
      clearTimeout(this.dripTimeout);
      this.dripTimeout = null;
    }

    const trigger = () => {
      if (!this.isPlaying) return;
      this.playWaterDrip();
      const nextDelay = 800 + Math.random() * 2200;
      this.dripTimeout = window.setTimeout(trigger, nextDelay);
    };
    this.dripTimeout = window.setTimeout(trigger, 1000);
  }

  // 4. 抚琴：空灵东方古琴单音
  public playGuqinString(noteIndex?: number) {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const index = noteIndex !== undefined 
      ? noteIndex % this.pentatonicFreqs.length 
      : Math.floor(Math.random() * this.pentatonicFreqs.length);

    const freq = this.pentatonicFreqs[index];
    const now = this.ctx.currentTime;

    // 基频振荡器
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);

    // 二次泛音增添古琴共鸣感
    const harmonicOsc = this.ctx.createOscillator();
    harmonicOsc.type = 'sine';
    harmonicOsc.frequency.setValueAtTime(freq * 2, now);

    const gain = this.ctx.createGain();
    // 快速拨弦起振，缓慢余音缭绕
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.35, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.5);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, now);

    osc.connect(filter);
    harmonicOsc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    harmonicOsc.start(now);
    osc.stop(now + 3.6);
    harmonicOsc.stop(now + 3.6);
  }

  // 5. 核心声学交互：当相机步入亭内，低通滤波器削减高频雨声，模拟屋檐遮蔽
  public setInPavilion(inPavilion: boolean) {
    if (!this.ctx || !this.rainFilterNode) return;
    const now = this.ctx.currentTime;
    if (inPavilion) {
      // 进亭：雨声沉闷隔音，降低截止频率至 800Hz
      this.rainFilterNode.frequency.linearRampToValueAtTime(850, now + 0.8);
      if (this.rainGainNode) {
        this.rainGainNode.gain.linearRampToValueAtTime(0.28, now + 0.8);
      }
    } else {
      // 出亭：开阔雨声，恢复高频
      this.rainFilterNode.frequency.linearRampToValueAtTime(3200, now + 0.8);
      if (this.rainGainNode) {
        this.rainGainNode.gain.linearRampToValueAtTime(0.42, now + 0.8);
      }
    }
  }

  // 调节天气对应的雨声大小
  public setWeatherIntensity(type: 'light' | 'moderate' | 'dusk' | 'night') {
    if (!this.ctx || !this.rainGainNode) return;
    const now = this.ctx.currentTime;
    const volumes = {
      light: 0.28,
      moderate: 0.48,
      dusk: 0.35,
      night: 0.22,
    };
    this.rainGainNode.gain.linearRampToValueAtTime(volumes[type], now + 0.5);
  }

  public setMasterVolume(val: number) {
    if (!this.ctx || !this.masterGain) return;
    this.masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, val)), this.ctx.currentTime);
  }
}

export const soundEngine = new SoundEngine();
