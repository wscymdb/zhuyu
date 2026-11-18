import React, { useEffect, useState, useMemo } from 'react';
import { useProgress } from '@react-three/drei';
import { useAppStore } from '../../stores/useAppStore';
import { soundEngine } from '../../utils/audioSynthesizer';

// 将 3D 底层贴图文件映射为典雅的国风游戏级资源文案
function formatResourceName(item: string): string {
  if (!item) return '构筑空山幽篁意境...';
  if (item.includes('culm')) return '千竿修竹竿节肌理 (Bamboo Culm)';
  if (item.includes('foliage')) return '婆娑青翠竹叶微纹 (Bamboo Foliage)';
  if (item.includes('damp-soil')) return '空山新雨湿润地表 (Damp Soil Terrain)';
  if (item.includes('moss-stone')) return '临溪苔石青绿岩质 (Moss Stone)';
  if (item.includes('river-stone')) return '石涧溪流卵石岩理 (River Stone)';
  if (item.includes('roof')) return '听雨亭双檐青瓦灰瓦 (Pavilion Roof PBR)';
  if (item.includes('floor')) return '亭台青石基台与石阶 (Stone Plinth PBR)';
  if (item.includes('RoofingTiles')) return '听雨亭双檐青瓦灰瓦 (Pavilion Roof PBR)';
  if (item.includes('Rocks025')) return '亭台青石基台与石阶 (Stone Plinth PBR)';
  
  // 提取文件名
  const parts = item.split('/');
  const filename = parts[parts.length - 1] || item;
  return `场景材质：${filename}`;
}

export const LoadingScreen: React.FC = () => {
  const { active, progress, item, loaded, total } = useProgress();
  const [smoothProgress, setSmoothProgress] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);

  // 平滑过渡进度百分比（防止跳跃，呈现细腻的游戏级丝滑进度）
  useEffect(() => {
    let animId: number;
    const target = Math.min(100, Math.max(0, progress));

    const updateSmooth = () => {
      setSmoothProgress((prev) => {
        const diff = target - prev;
        if (Math.abs(diff) < 0.5) return target;
        return prev + diff * 0.12;
      });
      animId = requestAnimationFrame(updateSmooth);
    };

    animId = requestAnimationFrame(updateSmooth);
    return () => cancelAnimationFrame(animId);
  }, [progress]);

  // 当加载进度满 100% 且资源加载完成
  useEffect(() => {
    if (smoothProgress >= 99 && (!active || loaded >= total)) {
      const timer = setTimeout(() => {
        setIsReady(true);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [smoothProgress, active, loaded, total]);

  // 资源描述文本
  const currentResourceText = useMemo(() => {
    if (isReady) return '所有景物与声效构筑完毕';
    return formatResourceName(item);
  }, [item, isReady]);

  // 点击进入禅境（不仅仪式感拉满，更可完美解锁浏览器的 Web Audio 自动发声权限）
  const handleEnter = () => {
    setIsFadingOut(true);

    // 唤醒 Web Audio 音频引擎，自然渐入山林雨声与流水声
    soundEngine.startAmbience();
    const appState = useAppStore.getState();
    soundEngine.setInPavilion(appState.cameraView === 'pavilion');
    soundEngine.setWeatherIntensity(appState.weather);
    useAppStore.setState({ isAudioPlaying: true });

    // 渐隐动画结束后彻底卸载
    setTimeout(() => {
      setHasEntered(true);
    }, 1200);
  };

  if (hasEntered) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-between select-none transition-all duration-1000 ease-out ${
        isFadingOut ? 'opacity-0 pointer-events-none scale-105' : 'opacity-100'
      }`}
      style={{
        background: 'radial-gradient(circle at center, #141c18 0%, #0c100e 65%, #060908 100%)',
      }}
    >
      {/* 顶部雅致印记 */}
      <div className="pt-12 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-900/60 bg-emerald-950/40 backdrop-blur-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs tracking-widest text-emerald-200/80 font-serif">
            WEB 3D ZEN SPACE
          </span>
        </div>
      </div>

      {/* 中央书法标题与意境诗句 */}
      <div className="flex flex-col items-center text-center px-6 -mt-8">
        {/* 红色篆刻小印 */}
        <div className="w-9 h-9 mb-4 rounded-sm border border-red-700/80 bg-red-900/40 text-red-300 flex items-center justify-center text-xs font-serif shadow-lg shadow-red-950/50">
          禅境
        </div>

        {/* 主标题 */}
        <h1 className="text-4xl md:text-5xl font-serif tracking-[0.3em] text-stone-100 drop-shadow-md mb-4 ml-3">
          听雨 · 幽篁
        </h1>

        {/* 古典意境诗词 */}
        <p className="text-sm md:text-base text-stone-400 tracking-[0.25em] font-serif leading-relaxed">
          独坐幽篁里，弹琴复长啸。深林人不知，明月来相照。
        </p>
      </div>

      {/* 底部游戏级资源加载进度区 */}
      <div className="w-full max-w-md px-8 pb-14 flex flex-col items-center">
        {!isReady ? (
          // 加载中动态状态
          <div className="w-full flex flex-col items-center">
            {/* 动态资源名与进度百分比 */}
            <div className="w-full flex justify-between items-end mb-2 text-xs">
              <span className="text-stone-400/90 font-serif tracking-wider truncate max-w-[280px]">
                {currentResourceText}
              </span>
              <span className="text-emerald-400 font-mono tracking-widest font-semibold ml-2">
                {Math.round(smoothProgress)}%
              </span>
            </div>

            {/* 细腻修长进度条 */}
            <div className="w-full h-1 bg-stone-800/80 rounded-full overflow-hidden border border-stone-700/30">
              <div
                className="h-full bg-gradient-to-r from-emerald-600 via-emerald-400 to-teal-300 transition-all duration-150 ease-out rounded-full shadow-[0_0_8px_rgba(52,211,153,0.6)]"
                style={{ width: `${smoothProgress}%` }}
              />
            </div>

            {/* 资源统计小字 */}
            <div className="mt-2 text-[11px] text-stone-500 font-serif tracking-widest">
              正在加载场景资源 {loaded > 0 ? `[${loaded} / ${total || 7}]` : '...'}
            </div>
          </div>
        ) : (
          // 资源加载完成 -> 醒目呼吸入静按钮
          <div className="flex flex-col items-center animate-fade-in">
            <button
              onClick={handleEnter}
              className="group relative px-8 py-3 rounded-full overflow-hidden border border-emerald-500/50 bg-emerald-950/40 hover:bg-emerald-900/60 transition-all duration-300 shadow-lg shadow-emerald-950/80 cursor-pointer active:scale-95"
            >
              {/* 呼吸光晕微效 */}
              <span className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-400/20 to-emerald-500/0 animate-[pulse_2s_infinite]" />
              <span className="relative text-base tracking-[0.3em] text-emerald-100 font-serif font-medium group-hover:text-emerald-50">
                点击入境 · 抚琴听雨
              </span>
            </button>
            <span className="mt-3 text-[11px] text-stone-500 tracking-widest font-serif">
              轻触开启山林微雨与流水意境
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
