// 沉浸式东方意境 Web Audio 声音系统 (Hybrid Dual-Engine 2.0)
// 【小雨】：专属播放真实高品质录音《细雨.mp3》（室外 20000Hz 全频无损直通 / 亭内 4500Hz 屋檐声学低通）
// 【中雨 / 大雨 / 暴雨】：原版程序化物理声音合成（多阶粉红噪声雨 + 流水 + 随机檐滴 + 暴雨狂风微雷）
// 【悠远山雀】：深山悠远布谷鸟鸣 (cuckoo.mp3)，空气吸声低通滤波 + 空间声像定位 + 轻柔弱音，呈现空谷回声之感

import { RainType } from '../types';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isInitialized = false;
  private isPlaying = false;

  // 1. 真实录音音轨 (小雨模式专属使用 rain.mp3)
  private realRainBuffer: AudioBuffer | null = null;
  private isPreloadingRealAudio = false;
  private realRainSource: AudioBufferSourceNode | null = null;
  private realRainGainNode: GainNode | null = null;
  private realRainFilterNode: BiquadFilterNode | null = null;

  // 2. 原版程序化雨声音轨 (中雨 / 大雨 / 暴雨，以及小雨加载完成前的无缝保底)
  private synthRainSource: AudioBufferSourceNode | null = null;
  private synthRainGainNode: GainNode | null = null;
  private synthRainFilterNode: BiquadFilterNode | null = null;

  // 3. 原版程序化流水声音轨
  private streamSource: AudioBufferSourceNode | null = null;
  private streamGainNode: GainNode | null = null;

  // 4. 悠远深山布谷鸟鸣 (cuckoo.mp3) 与动物鸣叫扩展
  private cuckooBuffer: AudioBuffer | null = null;
  private isPreloadingCuckoo = false;
  private currentCuckooSource: AudioBufferSourceNode | null = null;
  private currentCuckooGain: GainNode | null = null;
  private cuckooTimer: number | null = null;
  private currentAnimalSound: string = 'cuckoo';
  private animalVolume: number = 0.45; // 动物鸣叫专属音量 (0.0 ~ 1.0)

  // 5. 原版檐角滴水随机定时器
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

    // 立即预加载真实《细雨.mp3》与悠远《布谷鸟.mp3》
    this.preloadRealAudio();
    this.preloadCuckooAudio();
  }

  // 预加载真实《细雨.mp3》
  public async preloadRealAudio() {
    if (this.realRainBuffer || this.isPreloadingRealAudio) return;
    if (!this.ctx) {
      this.init();
    }
    if (!this.ctx) return;

    this.isPreloadingRealAudio = true;
    try {
      const res = await fetch('/audio/rain.mp3');
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        if (this.ctx) {
          const decoded = await this.ctx.decodeAudioData(arrayBuf);
          this.realRainBuffer = decoded;
          // 若当前正在播放且当前选中小雨，即刻唤醒真实雨声音轨
          if (this.isPlaying && this.currentRainType === 'light') {
            this.setupRealRainSource();
            this.updateAcoustics(0.4);
          }
        }
      }
    } catch (e) {
      console.warn('Real audio /audio/rain.mp3 fallback to synthetic sound:', e);
    } finally {
      this.isPreloadingRealAudio = false;
    }
  }

  // 预加载悠远深山布谷鸟啼鸣音源
  public async preloadCuckooAudio() {
    if (this.cuckooBuffer || this.isPreloadingCuckoo) return;
    if (!this.ctx) {
      this.init();
    }
    if (!this.ctx) return;

    this.isPreloadingCuckoo = true;
    try {
      const res = await fetch('/audio/cuckoo.mp3');
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        if (this.ctx) {
          this.cuckooBuffer = await this.ctx.decodeAudioData(arrayBuf);
        }
      }
    } catch (e) {
      console.warn('Cuckoo audio /audio/cuckoo.mp3 load failed:', e);
    } finally {
      this.isPreloadingCuckoo = false;
    }
  }

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

    const now = this.ctx.currentTime;
    if (this.realRainGainNode) {
      this.realRainGainNode.gain.linearRampToValueAtTime(0.0001, now + 0.3);
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
    }
    if (this.synthRainSource) {
      try {
        this.synthRainSource.stop();
        this.synthRainSource.disconnect();
      } catch {}
      this.synthRainSource = null;
    }
    if (this.streamSource) {
      try {
        this.streamSource.stop();
        this.streamSource.disconnect();
      } catch {}
      this.streamSource = null;
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
    return buffer;
  }

  // 生成流水白噪缓冲
  private createStreamBuffer(): AudioBuffer | null {
    if (!this.ctx) return null;
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.07;
    }
    return buffer;
  }

  // 装配真实录音音轨节点
  private setupRealRainSource() {
    if (!this.ctx || !this.masterGain || !this.realRainBuffer) return;
    if (this.realRainSource) {
      try {
        this.realRainSource.stop();
        this.realRainSource.disconnect();
      } catch {}
    }

    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.realRainBuffer;
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

  // 启动或重启无缝循环音轨
  private restartLoopers() {
    if (!this.ctx || !this.masterGain || !this.isPlaying) return;

    if (this.stopTimer !== null) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }

    this.stopAllSources();
    const now = this.ctx.currentTime;

    // 1. 真实录音音轨（【小雨】专属，若就绪立即装配）
    if (this.realRainBuffer) {
      this.setupRealRainSource();
    }

    // 2. 原版程序化雨声音轨（用于中雨、大雨、暴雨，以及小雨真实录音未加载完成时的防静音无缝保底）
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

    // 3. 原版程序化小溪流水音轨
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
   * 1. 小雨 (light)：
   *    - 真实录音音轨《细雨.mp3》播放
   *    - 非亭内（室外）：20,000Hz 全频无损直通，1.0 满格音量，流水静音
   *    - 亭内：4500Hz 温润屋檐声学低通，0.88 音量，清晰可闻
   *    - 若真实录音尚未 decode 完成，合成雨声暂时以 0.38 音量过渡保底，绝不出现静音！
   * 2. 中雨 (moderate)：
   *    - 程序化物理雨声 (室外 3400Hz, vol 0.50 / 亭内 1400Hz, vol 0.38) + 溪流 (vol 0.22)
   * 3. 大雨 (heavy)：
   *    - 密雨连绵 (室外 4400Hz, vol 0.75 / 亭内 1800Hz, vol 0.55) + 溪流 (vol 0.32)
   * 4. 暴雨 (storm)：
   *    - 狂风骤雨 (室外 5800Hz, vol 0.95 / 亭内 2200Hz, vol 0.70) + 激流 (vol 0.42)
   */
  private updateAcoustics(rampDuration = 0.5) {
    if (!this.ctx || !this.isPlaying) return;
    const now = this.ctx.currentTime;

    const isLightMode = this.currentRainType === 'light';

    if (isLightMode) {
      // ===== 【小雨模式】：专属播放真实录音《细雨.mp3》 =====
      const hasRealAudio = !!this.realRainBuffer && !!this.realRainGainNode;

      if (hasRealAudio) {
        // 1. 真实录音音轨生效
        if (this.realRainFilterNode) {
          // 室外 20000Hz (全频直通，零高频损失) / 亭内 4500Hz (温润屋檐声学，过滤极高频风噪，保持雨声清晰)
          this.realRainFilterNode.frequency.linearRampToValueAtTime(
            this.isInPavilion ? 4500 : 20000,
            now + rampDuration
          );
        }
        if (this.realRainGainNode) {
          // 室外 1:1 饱满音量，室内微调至 0.88（温润清雅，清晰可闻）
          this.realRainGainNode.gain.linearRampToValueAtTime(
            this.isInPavilion ? 0.88 : 1.0,
            now + rampDuration
          );
        }

        // 2. 真实录音已出声，平滑淡出合成雨声与溪流
        if (this.synthRainGainNode) {
          this.synthRainGainNode.gain.linearRampToValueAtTime(0.0001, now + rampDuration);
        }
        if (this.streamGainNode) {
          this.streamGainNode.gain.linearRampToValueAtTime(0.0001, now + rampDuration);
        }
      } else {
        // 3. 保底：真实录音尚在加载时，让程序化轻柔雨声暂代，保证随时有声
        if (this.synthRainFilterNode) {
          this.synthRainFilterNode.frequency.linearRampToValueAtTime(
            this.isInPavilion ? 1800 : 2800,
            now + rampDuration
          );
        }
        if (this.synthRainGainNode) {
          this.synthRainGainNode.gain.linearRampToValueAtTime(
            this.isInPavilion ? 0.30 : 0.38,
            now + rampDuration
          );
        }
      }
    } else {
      // ===== 【中雨 / 大雨 / 暴雨】：多阶程序化物理声音合成 =====
      // 1. 关闭真实录音音轨
      if (this.realRainGainNode) {
        this.realRainGainNode.gain.linearRampToValueAtTime(0.0001, now + rampDuration);
      }

      // 2. 梯度声学参数表
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

  // 随机檐角水滴
  private startRandomDrips() {
    if (this.dripTimeout !== null) {
      clearTimeout(this.dripTimeout);
      this.dripTimeout = null;
    }

    const trigger = () => {
      if (!this.isPlaying) return;
      // 仅在非小雨模式下运行程序化檐滴（小雨自身录音已蕴含生动屋檐滴水声）
      if (this.currentRainType !== 'light') {
        this.playWaterDrip();
      }
      const intervals: Record<RainType, [number, number]> = {
        light: [3000, 5000],
        moderate: [1200, 2600],
        heavy: [600, 1400],
        storm: [250, 600],
      };
      const [minDelay, maxDelay] = intervals[this.currentRainType] || [1200, 2600];
      const nextDelay = minDelay + Math.random() * (maxDelay - minDelay);
      this.dripTimeout = window.setTimeout(trigger, nextDelay);
    };
    this.dripTimeout = window.setTimeout(trigger, 1200);
  }

  // 播放一次悠远深山的布谷鸟啼鸣 (营造远山幽林意境，避免贴脸感，单次仅啼鸣1~2声)
  public playDistantCuckoo() {
    if (!this.ctx || !this.masterGain || !this.isPlaying || !this.cuckooBuffer) return;

    // 若动物叫声关闭或音量为0，则不播放
    if (this.currentAnimalSound !== 'cuckoo' || this.animalVolume <= 0.001) return;

    // 暴雨天雷鸣风狂，鸟雀深栖不鸣
    if (this.currentRainType === 'storm') return;

    // 若上一声仍在发声，先优雅释放
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

    // 1. 空气远距离吸声与高频漫射滤波 (Atmospheric Absorption Low-Pass)
    // 远山深林距离感关键：低通截止在 2600Hz ~ 3000Hz，滤除近场刺耳齿音，呈现空谷回荡感
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    const cutoffFreq = this.isInPavilion ? 2000 : 2800;
    filter.frequency.setValueAtTime(cutoffFreq, now);
    filter.Q.setValueAtTime(0.707, now);

    // 2. 声学空间声像定位 (Stereo Panning)
    // 随机将鸟声散布在左侧山岚或右侧竹海深处 (-0.55 ~ +0.55)，呈现空旷的群山声场
    let panner: StereoPannerNode | null = null;
    if (typeof this.ctx.createStereoPanner === 'function') {
      try {
        panner = this.ctx.createStereoPanner();
        const panDir = Math.random() > 0.5 ? 1 : -1;
        const panVal = panDir * (0.35 + Math.random() * 0.25);
        panner.pan.setValueAtTime(panVal, now);
      } catch {}
    }

    // 3. 远山轻柔弱音衰减与叫声音量控制 (Distant Volume Attenuation)
    // 结合用户调节的 animalVolume：室外基础 0.16，亭内 0.11，轻柔微茫，绝不贴脸
    const baseVol = (this.isInPavilion ? 0.11 : 0.16) * this.animalVolume;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(baseVol, now + 0.8); // 0.8秒柔和渐入

    // 4. 控制单次叫声长度：绝不连叫14.5秒（原音频有8次叫声），单次触发仅啼叫 1~2 声即静止
    const callCount = Math.random() > 0.4 ? 2 : 1;
    const callDuration = callCount === 1 ? 3.0 : 4.8; // 3.0s刚好一声，4.8s刚好两声
    gain.gain.setValueAtTime(baseVol, now + callDuration - 1.2);
    gain.gain.linearRampToValueAtTime(0.0001, now + callDuration);

    // 连接节点链: src -> filter -> (panner) -> gain -> masterGain
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

  // 调度悠远布谷鸟啼鸣循环 (间隔拉长至1~2.5分钟偶闻一声，绝不一直叫)
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
        // 下一次啼鸣在 70秒 ~ 150秒 (1分多钟~2分半) 之间偶闻一声，空山幽寂
        scheduleNext(70000, 150000);
      }, delay);
    };

    // 首次啼鸣在开启环境音后约 20 ~ 35 秒在远山幽幽响起
    scheduleNext(20000, 35000);
  }

  // 切换动物鸣叫种类 (当前支持 'cuckoo' | 'none'，后续可扩展更多)
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

  // 切换雨势等级（小雨 / 中雨 / 大雨 / 暴雨）
  public setRainType(type: RainType) {
    this.currentRainType = type;
    this.updateAcoustics(0.5);
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

// 页面加载阶段尽早预加载音频
if (typeof window !== 'undefined') {
  setTimeout(() => {
    soundEngine.preloadRealAudio();
    soundEngine.preloadCuckooAudio();
  }, 100);
}
