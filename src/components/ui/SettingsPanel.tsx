import { MAX_WATER_IMPACT_DENSITY } from '../../utils/rainWaterPresets';
import React, { useState } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { RainType, TimeOfDayType } from '../../types';
import {
  Sliders,
  RotateCcw,
  X,
  ZoomIn,
  Eye,
  Move,
  CloudRain,
  Wind,
  CloudFog,
  Sun,
  Trees,
  Compass,
  Sparkles,
  Volume2,
  VolumeX,
  ChevronDown,
  CloudDrizzle,
  CloudLightning,
  Sunrise,
  Sunset,
  Moon,
  Clock,
  Bird,
  Zap,
} from 'lucide-react';

const ANIMAL_SOUNDS = [
  { id: 'cuckoo', label: '布谷鸟', sub: '空谷子规啼', icon: <Bird size={13} /> },
  { id: 'none', label: '静音', sub: '万籁空寂', icon: <VolumeX size={13} /> },
];

const RAIN_OPTIONS: { type: RainType; label: string; desc: string; icon: React.ReactNode }[] = [
  { type: 'light', label: '小雨', desc: '轻柔 · 真实自然录音', icon: <CloudDrizzle size={13} /> },
  { type: 'moderate', label: '中雨', desc: '潇潇 · 真实自然录音', icon: <CloudRain size={13} /> },
  { type: 'heavy', label: '大雨', desc: '密雨 · 敲竹鸣瓦', icon: <CloudRain size={13} /> },
  { type: 'storm', label: '暴雨', desc: '骤雨 · 狂风呼啸', icon: <CloudLightning size={13} /> },
  { type: 'thunder', label: '雷雨', desc: '电闪雷鸣 · 惊雷破空', icon: <Zap size={13} /> },
];

const TIME_OPTIONS: { type: TimeOfDayType; label: string; desc: string; icon: React.ReactNode }[] = [
  { type: 'dawn', label: '晨曦', desc: '破晓微光', icon: <Sunrise size={13} /> },
  { type: 'day', label: '白昼', desc: '天青朗润', icon: <Sun size={13} /> },
  { type: 'dusk', label: '暮色', desc: '落日霞光', icon: <Sunset size={13} /> },
  { type: 'night', label: '子夜', desc: '空山明月', icon: <Moon size={13} /> },
];

function formatShichen(hour: number): string {
  const h = (hour + 1) % 24;
  const shichenNames = [
    '子时 · 夜半',
    '丑时 · 鸡鸣',
    '寅时 · 平旦',
    '卯时 · 日出',
    '辰时 · 食时',
    '巳时 · 隅中',
    '午时 · 日中',
    '未时 · 日昳',
    '申时 · 晡时',
    '酉时 · 日入',
    '戌时 · 黄昏',
    '亥时 · 人定',
  ];
  const idx = Math.floor(h / 2);
  const hourInt = Math.floor(hour);
  const minInt = Math.floor((hour % 1) * 60);
  const hh = hourInt.toString().padStart(2, '0');
  const mm = minInt.toString().padStart(2, '0');
  return `${hh}:${mm} (${shichenNames[idx % 12]})`;
}

export const SettingsPanel: React.FC = () => {
  const isSettingsOpen = useAppStore((state) => state.isSettingsOpen);
  const toggleSettings = useAppStore((state) => state.toggleSettings);
  const config = useAppStore((state) => state.config);
  const setConfig = useAppStore((state) => state.setConfig);
  const resetRainWaterPreset = useAppStore(state => state.resetRainWaterPreset);
  const resetConfig = useAppStore((state) => state.resetConfig);
  const volume = useAppStore((state) => state.volume);
  const setVolume = useAppStore((state) => state.setVolume);
  const isAudioPlaying = useAppStore((state) => state.isAudioPlaying);
  const toggleAudio = useAppStore((state) => state.toggleAudio);

  // 雨势与时间
  const rainType = useAppStore((state) => state.rainType);
  const setRainType = useAppStore((state) => state.setRainType);
  const timeOfDay = useAppStore((state) => state.timeOfDay);
  const setTimeOfDay = useAppStore((state) => state.setTimeOfDay);
  const timeHour = useAppStore((state) => state.timeHour);
  const setTimeHour = useAppStore((state) => state.setTimeHour);

  // 动物叫声与音量
  const animalSound = useAppStore((state) => state.animalSound);
  const setAnimalSound = useAppStore((state) => state.setAnimalSound);
  const animalVolume = useAppStore((state) => state.animalVolume);
  const setAnimalVolume = useAppStore((state) => state.setAnimalVolume);

  // 折叠手风琴状态管理（默认展开声音和自然，其余折叠保持界面轻爽）
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    audio: true,    // 禅音雅韵 (声音控制)
    weather: true,  // 烟雨自然 (雨势与时辰)
    bamboo: false,  // 修竹幽篁
    camera: false,  // 运镜视界
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  if (!isSettingsOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-30 w-[440px] max-w-[94vw] glass-panel shadow-2xl p-6 flex flex-col justify-between border-l border-emerald-900/30 animate-ink overflow-y-auto">
      <div>
        {/* 面板头部 */}
        <div className="flex items-center justify-between pb-3.5 border-b border-stone-800/80 mb-4">
          <div className="flex items-center gap-2 text-stone-200">
            <Sliders size={17} className="text-emerald-400" />
            <h2 className="font-serif text-sm font-semibold tracking-wider">境象调控 · 视界设置</h2>
          </div>
          <button
            onClick={toggleSettings}
            className="p-1.5 rounded-full hover:bg-stone-800 text-stone-400 hover:text-stone-200 transition-colors cursor-pointer"
            title="关闭面板"
          >
            <X size={15} />
          </button>
        </div>

        <div className="space-y-3">
          {/* 1. 禅音雅韵 (声音大小调控) */}
          <div className="border border-stone-800/60 rounded-xl bg-stone-900/30 overflow-hidden">
            <button
              onClick={() => toggleSection('audio')}
              className="w-full flex items-center justify-between p-3 text-xs font-serif text-emerald-400/90 font-medium tracking-widest hover:text-emerald-300 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <Volume2 size={14} className="text-emerald-400" />
                <span>〔 禅音雅韵 〕</span>
              </span>
              <ChevronDown
                size={14}
                className={`text-stone-400 transform transition-transform duration-200 ${
                  openSections.audio ? 'rotate-180' : ''
                }`}
              />
            </button>

            {openSections.audio && (
              <div className="px-3.5 pb-4 space-y-3.5 border-t border-stone-800/40 pt-3">
                {/* 主音量滑块 */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-stone-300">
                    <span className="flex items-center gap-1.5">
                      {volume > 0.01 ? (
                        <Volume2 size={13} className="text-emerald-400" />
                      ) : (
                        <VolumeX size={13} className="text-stone-500" />
                      )}
                      <span>主环境音量</span>
                    </span>
                    <span className="text-emerald-300 font-mono text-[11px]">
                      {Math.round(volume * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-stone-800 rounded-lg appearance-none"
                  />
                  <div className="flex justify-between items-center text-[10px] text-stone-400/70 pt-0.5">
                    <span>静音</span>
                    <span>适中 (70%)</span>
                    <span>饱满 (100%)</span>
                  </div>
                </div>

                {/* 音频开关快捷切换 */}
                <div className="flex items-center justify-between pt-1 text-xs">
                  <span className="text-stone-400">音频播放状态</span>
                  <button
                    onClick={toggleAudio}
                    className={`px-3 py-1 rounded-full text-[11px] font-serif transition-all cursor-pointer ${
                      isAudioPlaying
                        ? 'border border-emerald-500/50 bg-emerald-950/40 text-emerald-300 shadow'
                        : 'border border-stone-700 bg-stone-800/60 text-stone-400'
                    }`}
                  >
                    {isAudioPlaying ? '正在播放' : '已暂停'}
                  </button>
                </div>

                {/* 动物生灵叫声选择与音量设置 */}
                <div className="pt-3 border-t border-stone-800/40 space-y-2.5">
                  <div className="flex justify-between items-center text-xs text-stone-300">
                    <span className="flex items-center gap-1.5">
                      <Bird size={13} className="text-emerald-400" />
                      <span className="font-medium">空山鸣禽 · 动物叫声</span>
                    </span>
                    <span className="text-[11px] text-emerald-300 font-serif">
                      {animalSound === 'cuckoo' ? '布谷鸟 · 偶闻幽啼' : '万籁静寂'}
                    </span>
                  </div>

                  {/* 动物种类选择按钮组 (可灵活扩展) */}
                  <div className="grid grid-cols-2 gap-2">
                    {ANIMAL_SOUNDS.map((item) => {
                      const active = animalSound === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => setAnimalSound(item.id)}
                          className={`py-2 px-3 rounded-lg text-xs font-serif flex items-center justify-between gap-1.5 transition-all cursor-pointer ${
                            active
                              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/50 shadow-md shadow-emerald-950/40'
                              : 'bg-stone-850/60 text-stone-400 hover:text-stone-200 border border-stone-800/80 hover:border-stone-700'
                          }`}
                        >
                          <span className="flex items-center gap-1.5">
                            <span className={active ? 'text-emerald-400' : 'text-stone-400'}>
                              {item.icon}
                            </span>
                            <span className="font-medium">{item.label}</span>
                          </span>
                          <span className="text-[10px] text-stone-500">{item.sub}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* 动物叫声音量独立滑块 */}
                  {animalSound !== 'none' && (
                    <div className="space-y-1.5 pt-1.5 bg-stone-950/30 p-2.5 rounded-lg border border-stone-800/50">
                      <div className="flex justify-between text-xs text-stone-300">
                        <span className="text-[11px] text-stone-400 flex items-center gap-1">
                          <Sliders size={11} className="text-stone-400" />
                          <span>叫声音量大小</span>
                        </span>
                        <span className="text-emerald-300 font-mono text-[11px]">
                          {Math.round(animalVolume * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.02"
                        value={animalVolume}
                        onChange={(e) => setAnimalVolume(parseFloat(e.target.value))}
                        className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-stone-800 rounded-lg appearance-none"
                      />
                      <div className="flex justify-between text-[10px] text-stone-500 pt-0.5">
                        <span>轻柔隐约 (20%)</span>
                        <span>适中幽远 (45%)</span>
                        <span>清晰回荡 (100%)</span>
                      </div>
                      <div className="text-[10px] text-emerald-400/60 pt-1">
                        提示：单次仅偶啼 1~2 声，每隔 1~2.5 分钟在远山自然回荡，绝不喧闹。
                      </div>
                    </div>
                  )}
                </div>

                <div className="text-[10px] text-emerald-400/70 bg-emerald-950/20 p-2 rounded-lg border border-emerald-900/30">
                  小雨、中雨与雷雨播放对应的真实自然原声；大雨、暴雨采用多阶雨声合成。
                </div>
              </div>
            )}
          </div>

          {/* 2. 烟雨气象 (雨势等级与时辰天光调控) */}
          <div className="border border-stone-800/60 rounded-xl bg-stone-900/30 overflow-hidden">
            <button
              onClick={() => toggleSection('weather')}
              className="w-full flex items-center justify-between p-3 text-xs font-serif text-emerald-400/90 font-medium tracking-widest hover:text-emerald-300 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <CloudRain size={14} className="text-emerald-400" />
                <span>〔 烟雨自然 〕</span>
              </span>
              <ChevronDown
                size={14}
                className={`text-stone-400 transform transition-transform duration-200 ${
                  openSections.weather ? 'rotate-180' : ''
                }`}
              />
            </button>

            {openSections.weather && (
              <div className="px-3.5 pb-4 space-y-4 border-t border-stone-800/40 pt-3">
                {/* A. 雨势等级选择：小雨、中雨、大雨、暴雨 */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs text-stone-300">
                    <span className="flex items-center gap-1.5">
                      <CloudRain size={13} className="text-emerald-400" />
                      <span className="font-medium">雨势等级</span>
                    </span>
                    <span className="text-[11px] text-emerald-300 font-serif">
                      {RAIN_OPTIONS.find((r) => r.type === rainType)?.desc}
                    </span>
                  </div>

                  <div className="grid grid-cols-5 gap-1">
                    {RAIN_OPTIONS.map((opt) => {
                      const active = rainType === opt.type;
                      return (
                        <button
                          key={opt.type}
                          onClick={() => setRainType(opt.type)}
                          className={`py-2 px-0.5 rounded-lg text-xs font-serif flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                            active
                              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/50 shadow-md shadow-emerald-950/40'
                              : 'bg-stone-850/60 text-stone-400 hover:text-stone-200 border border-stone-800/80 hover:border-stone-700'
                          }`}
                        >
                          <span className={active ? 'text-emerald-400' : 'text-stone-400'}>
                            {opt.icon}
                          </span>
                          <span className="font-medium text-[11px]">{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3 pt-3 border-t border-stone-800/40">
                  <div className="flex justify-between items-center text-xs text-stone-300">
                    <span>雨落溪面</span>
                    <button onClick={resetRainWaterPreset} className="text-[10px] text-emerald-400 hover:text-emerald-200 cursor-pointer">恢复当前雨种水面预设</button>
                  </div>
                  {([
                    { key: 'waterImpactStrength', label: '落水力度', max: 2, hint: '越大，落点凹陷越深、波峰与水花越明显' },
                    { key: 'waterImpactDensity', label: '落点密度', max: MAX_WATER_IMPACT_DENSITY, hint: '越大，同一片水面上的涟漪越密集' },
                  ] as const).map(({ key, label, max, hint }) => (
                    <div key={key} className="space-y-1.5">
                      <label htmlFor={key} className="flex justify-between text-xs text-stone-300">
                        <span>{label}</span>
                        <span className="text-emerald-300 font-mono text-[11px]">{config[key].toFixed(2)}x</span>
                      </label>
                      <input id={key} type="range" min="0" max={max} step="0.05" value={config[key]}
                        onChange={e => setConfig(key, parseFloat(e.target.value))}
                        className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-stone-800 rounded-lg appearance-none" />
                      <p className="text-[10px] text-stone-500">{hint}</p>
                    </div>
                  ))}
                  <p className="text-[10px] text-emerald-400/70">每种雨势单独记住调整；切换雨种或重新打开页面可复用。</p>
                </div>

                {/* B. 时辰天光选择：晨曦、白昼、暮色、子夜 */}
                <div className="space-y-2 pt-1 border-t border-stone-800/40">
                  <div className="flex justify-between items-center text-xs text-stone-300">
                    <span className="flex items-center gap-1.5">
                      <Sun size={13} className="text-emerald-400" />
                      <span className="font-medium">时辰天光</span>
                    </span>
                    <span className="text-[11px] text-emerald-300 font-serif">
                      {TIME_OPTIONS.find((t) => t.type === timeOfDay)?.desc}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5">
                    {TIME_OPTIONS.map((opt) => {
                      const active = timeOfDay === opt.type;
                      return (
                        <button
                          key={opt.type}
                          onClick={() => setTimeOfDay(opt.type)}
                          className={`py-2 px-1 rounded-lg text-xs font-serif flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                            active
                              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/50 shadow-md shadow-emerald-950/40'
                              : 'bg-stone-850/60 text-stone-400 hover:text-stone-200 border border-stone-800/80 hover:border-stone-700'
                          }`}
                        >
                          <span className={active ? 'text-emerald-400' : 'text-stone-400'}>
                            {opt.icon}
                          </span>
                          <span className="font-medium text-xs">{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* 24 小时辰序平滑滑块 */}
                  <div className="space-y-1.5 pt-2">
                    <div className="flex justify-between text-xs text-stone-300">
                      <span className="flex items-center gap-1.5 text-stone-400 text-[11px]">
                        <Clock size={12} className="text-stone-400" />
                        <span>时令流转</span>
                      </span>
                      <span className="text-emerald-300 font-mono text-[11px]">
                        {formatShichen(timeHour)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="24"
                      step="0.25"
                      value={timeHour}
                      onChange={(e) => setTimeHour(parseFloat(e.target.value))}
                      className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-stone-800 rounded-lg appearance-none"
                    />
                    <div className="flex justify-between text-[10px] text-stone-500 pt-0.5 font-serif">
                      <span>子夜 (00:00)</span>
                      <span>晨曦 (06:00)</span>
                      <span>白昼 (12:00)</span>
                      <span>暮色 (18:00)</span>
                      <span>子夜 (24:00)</span>
                    </div>
                  </div>
                </div>

                {/* C. 细部自然参数微调 */}
                <div className="pt-2 border-t border-stone-800/40 space-y-3">
                  {/* 雨丝倾泻强度 */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-stone-300">
                      <span className="flex items-center gap-1.5">
                        <CloudRain size={13} className="text-stone-400" />
                        <span>雨丝倾泻强度</span>
                      </span>
                      <span className="text-emerald-300 font-mono text-[11px]">
                        {config.rainIntensity.toFixed(2)}x
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.3"
                      max="2.0"
                      step="0.1"
                      value={config.rainIntensity}
                      onChange={(e) => setConfig('rainIntensity', parseFloat(e.target.value))}
                      className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-stone-800 rounded-lg appearance-none"
                    />
                  </div>

                  {/* 竹浪风力 */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-stone-300">
                      <span className="flex items-center gap-1.5">
                        <Wind size={13} className="text-stone-400" />
                        <span>微风与竹浪摆动</span>
                      </span>
                      <span className="text-emerald-300 font-mono text-[11px]">
                        {config.windSpeed.toFixed(2)}x
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.2"
                      max="2.5"
                      step="0.1"
                      value={config.windSpeed}
                      onChange={(e) => setConfig('windSpeed', parseFloat(e.target.value))}
                      className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-stone-800 rounded-lg appearance-none"
                    />
                  </div>

                  {/* 烟岚薄雾浓度 */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-stone-300">
                      <span className="flex items-center gap-1.5">
                        <CloudFog size={13} className="text-stone-400" />
                        <span>烟岚薄雾浓度</span>
                      </span>
                      <span className="text-emerald-300 font-mono text-[11px]">
                        {(config.fogDensity * 100).toFixed(1)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.005"
                      max="0.045"
                      step="0.002"
                      value={config.fogDensity}
                      onChange={(e) => setConfig('fogDensity', parseFloat(e.target.value))}
                      className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-stone-800 rounded-lg appearance-none"
                    />
                  </div>

                  {/* 天光亮度 */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-stone-300">
                      <span className="flex items-center gap-1.5">
                        <Sun size={13} className="text-stone-400" />
                        <span>天光环境亮度</span>
                      </span>
                      <span className="text-emerald-300 font-mono text-[11px]">
                        {config.lightBrightness.toFixed(2)}x
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.6"
                      max="2.2"
                      step="0.1"
                      value={config.lightBrightness}
                      onChange={(e) => setConfig('lightBrightness', parseFloat(e.target.value))}
                      className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-stone-800 rounded-lg appearance-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 3. 修竹幽篁 (竹林密度与净空) */}
          <div className="border border-stone-800/60 rounded-xl bg-stone-900/30 overflow-hidden">
            <button
              onClick={() => toggleSection('bamboo')}
              className="w-full flex items-center justify-between p-3 text-xs font-serif text-emerald-400/90 font-medium tracking-widest hover:text-emerald-300 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <Trees size={14} className="text-emerald-400" />
                <span>〔 修竹幽篁 〕</span>
              </span>
              <ChevronDown
                size={14}
                className={`text-stone-400 transform transition-transform duration-200 ${
                  openSections.bamboo ? 'rotate-180' : ''
                }`}
              />
            </button>

            {openSections.bamboo && (
              <div className="px-3.5 pb-4 space-y-3.5 border-t border-stone-800/40 pt-3">
                {/* 竹子总株数 */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-stone-300">
                    <span className="flex items-center gap-1.5">
                      <Sparkles size={13} className="text-stone-400" />
                      <span>竹林总株数</span>
                    </span>
                    <span className="text-emerald-300 font-mono text-[11px]">
                      {config.bambooCount} 株
                    </span>
                  </div>
                  <input
                    type="range"
                    min="150"
                    max="850"
                    step="25"
                    value={config.bambooCount}
                    onChange={(e) => setConfig('bambooCount', parseInt(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-stone-800 rounded-lg appearance-none"
                  />
                  <div className="text-[10px] text-stone-400/70">调低更疏朗清简，调高形成苍茫竹海</div>
                </div>

                {/* 亭台与步道避让净空 */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-stone-300">
                    <span className="flex items-center gap-1.5">
                      <Compass size={13} className="text-stone-400" />
                      <span>亭台步道净空</span>
                    </span>
                    <span className="text-emerald-300 font-mono text-[11px]">
                      {config.bambooClearance.toFixed(1)} 米
                    </span>
                  </div>
                  <input
                    type="range"
                    min="3.8"
                    max="6.5"
                    step="0.1"
                    value={config.bambooClearance}
                    onChange={(e) => setConfig('bambooClearance', parseFloat(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-stone-800 rounded-lg appearance-none"
                  />
                  <div className="text-[10px] text-stone-400/70">让亭前、门廊与林间小径更开阔无阻</div>
                </div>

                {/* 竹海间距疏密倍率 */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-stone-300">
                    <span className="flex items-center gap-1.5">
                      <Trees size={13} className="text-stone-400" />
                      <span>山野竹间距离</span>
                    </span>
                    <span className="text-emerald-300 font-mono text-[11px]">
                      {config.bambooDensity.toFixed(2)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.75"
                    max="1.6"
                    step="0.05"
                    value={config.bambooDensity}
                    onChange={(e) => setConfig('bambooDensity', parseFloat(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-stone-800 rounded-lg appearance-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 4. 运镜视界 (操作感度调控) */}
          <div className="border border-stone-800/60 rounded-xl bg-stone-900/30 overflow-hidden">
            <button
              onClick={() => toggleSection('camera')}
              className="w-full flex items-center justify-between p-3 text-xs font-serif text-emerald-400/90 font-medium tracking-widest hover:text-emerald-300 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <Compass size={14} className="text-emerald-400" />
                <span>〔 运镜视界 〕</span>
              </span>
              <ChevronDown
                size={14}
                className={`text-stone-400 transform transition-transform duration-200 ${
                  openSections.camera ? 'rotate-180' : ''
                }`}
              />
            </button>

            {openSections.camera && (
              <div className="px-3.5 pb-4 space-y-3.5 border-t border-stone-800/40 pt-3">
                {/* 滚轮缩放速度 */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-stone-300">
                    <span className="flex items-center gap-1.5">
                      <ZoomIn size={13} className="text-stone-400" />
                      <span>滚轮缩放速度</span>
                    </span>
                    <span className="text-emerald-300 font-mono text-[11px]">
                      {config.zoomSpeed.toFixed(2)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.2"
                    step="0.05"
                    value={config.zoomSpeed}
                    onChange={(e) => setConfig('zoomSpeed', parseFloat(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-stone-800 rounded-lg appearance-none"
                  />
                  <div className="text-[10px] text-stone-400/70">调低可获得丝滑平稳的变焦推拉体验</div>
                </div>

                {/* 旋转灵敏度 */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-stone-300">
                    <span className="flex items-center gap-1.5">
                      <Eye size={13} className="text-stone-400" />
                      <span>视角旋转速度</span>
                    </span>
                    <span className="text-emerald-300 font-mono text-[11px]">
                      {config.rotateSpeed.toFixed(2)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="1.5"
                    step="0.05"
                    value={config.rotateSpeed}
                    onChange={(e) => setConfig('rotateSpeed', parseFloat(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-stone-800 rounded-lg appearance-none"
                  />
                </div>

                {/* 漫游行走步速 */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-stone-300">
                    <span className="flex items-center gap-1.5">
                      <Move size={13} className="text-stone-400" />
                      <span>漫游移动步速</span>
                    </span>
                    <span className="text-emerald-300 font-mono text-[11px]">
                      {config.moveSpeed.toFixed(1)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="12.0"
                    step="0.5"
                    value={config.moveSpeed}
                    onChange={(e) => setConfig('moveSpeed', parseFloat(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-stone-800 rounded-lg appearance-none"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 底部重置按钮 */}
      <div className="pt-4 border-t border-stone-800/80 mt-4">
        <button
          onClick={() => {
            resetConfig();
            setVolume(0.85);
            setRainType('light');
            setTimeOfDay('day');
            setAnimalSound('cuckoo');
            setAnimalVolume(0.45);
          }}
          className="w-full py-2.5 px-4 rounded-xl border border-stone-700/60 hover:border-emerald-500/40 text-stone-300 hover:text-white flex items-center justify-center gap-2 text-xs transition-all glass-panel-hover font-serif cursor-pointer active:scale-95"
        >
          <RotateCcw size={13} />
          <span>恢复默认清静配置</span>
        </button>
      </div>
    </div>
  );
};
