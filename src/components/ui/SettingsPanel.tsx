import React from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { Sliders, RotateCcw, X, ZoomIn, Eye, Move, CloudRain, Wind, CloudFog, Sun, Trees, Compass, Sparkles } from 'lucide-react';

export const SettingsPanel: React.FC = () => {
  const isSettingsOpen = useAppStore((state) => state.isSettingsOpen);
  const toggleSettings = useAppStore((state) => state.toggleSettings);
  const config = useAppStore((state) => state.config);
  const setConfig = useAppStore((state) => state.setConfig);
  const resetConfig = useAppStore((state) => state.resetConfig);

  if (!isSettingsOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-30 w-80 max-w-full glass-panel shadow-2xl p-6 flex flex-col justify-between border-l border-emerald-900/30 animate-ink overflow-y-auto">
      <div>
        {/* 面板头部 */}
        <div className="flex items-center justify-between pb-4 border-b border-stone-800/80 mb-5">
          <div className="flex items-center gap-2 text-stone-200">
            <Sliders size={18} className="text-emerald-400" />
            <h2 className="font-serif text-base font-semibold tracking-wider">境象调控 · 视界设置</h2>
          </div>
          <button
            onClick={toggleSettings}
            className="p-1.5 rounded-full hover:bg-stone-800 text-stone-400 hover:text-stone-200 transition-colors"
            title="关闭面板"
          >
            <X size={16} />
          </button>
        </div>

        {/* 1. 镜头视界调控 */}
        <div className="space-y-4 mb-6">
          <div className="text-xs font-serif text-emerald-400/90 font-medium tracking-widest flex items-center gap-1.5">
            <span>〔 运镜感度 〕</span>
          </div>

          {/* 滚轮缩放速度 */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-stone-300">
              <span className="flex items-center gap-1.5">
                <ZoomIn size={13} className="text-stone-400" />
                <span>滚轮缩放速度</span>
              </span>
              <span className="text-emerald-300 font-mono text-[11px]">{config.zoomSpeed.toFixed(2)}x</span>
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
              <span className="text-emerald-300 font-mono text-[11px]">{config.rotateSpeed.toFixed(2)}x</span>
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
              <span className="text-emerald-300 font-mono text-[11px]">{config.moveSpeed.toFixed(1)}</span>
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

        {/* 2. 自然与意境氛围调控 */}
        <div className="space-y-4">
          <div className="text-xs font-serif text-emerald-400/90 font-medium tracking-widest flex items-center gap-1.5">
            <span>〔 烟雨自然 〕</span>
          </div>

          {/* 雨势大小 */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-stone-300">
              <span className="flex items-center gap-1.5">
                <CloudRain size={13} className="text-stone-400" />
                <span>雨丝倾泻强度</span>
              </span>
              <span className="text-emerald-300 font-mono text-[11px]">{config.rainIntensity.toFixed(2)}x</span>
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
              <span className="text-emerald-300 font-mono text-[11px]">{config.windSpeed.toFixed(2)}x</span>
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
              <span className="text-emerald-300 font-mono text-[11px]">{(config.fogDensity * 100).toFixed(1)}%</span>
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
              <span className="text-emerald-300 font-mono text-[11px]">{config.lightBrightness.toFixed(2)}x</span>
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

        {/* 3. 修竹幽篁排布调控 (用户定制数量与疏密净空) */}
        <div className="space-y-4 mt-6">
          <div className="text-xs font-serif text-emerald-400/90 font-medium tracking-widest flex items-center gap-1.5">
            <Trees size={14} />
            <span>〔 修竹幽篁 〕</span>
          </div>

          {/* 竹子总数量规模 */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-stone-300">
              <span className="flex items-center gap-1.5">
                <Sparkles size={13} className="text-stone-400" />
                <span>竹林总株数</span>
              </span>
              <span className="text-emerald-300 font-mono text-[11px]">{config.bambooCount} 株</span>
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
            <div className="text-[10px] text-stone-400/70">调低更疏朗清简，调高形成苍茫深林竹海</div>
          </div>

          {/* 亭台与步道避让净空 */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-stone-300">
              <span className="flex items-center gap-1.5">
                <Compass size={13} className="text-stone-400" />
                <span>亭台步道净空</span>
              </span>
              <span className="text-emerald-300 font-mono text-[11px]">{config.bambooClearance.toFixed(1)} 米</span>
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
            <div className="text-[10px] text-stone-400/70">调大让亭子前门、入亭前坪与林间泥径更加开阔无阻</div>
          </div>

          {/* 竹海间距疏密倍率 */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-stone-300">
              <span className="flex items-center gap-1.5">
                <Trees size={13} className="text-stone-400" />
                <span>山野竹间距离</span>
              </span>
              <span className="text-emerald-300 font-mono text-[11px]">{config.bambooDensity.toFixed(2)}x</span>
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
      </div>

      {/* 底部重置按钮 */}
      <div className="pt-6 border-t border-stone-800/80">
        <button
          onClick={resetConfig}
          className="w-full py-2.5 px-4 rounded-xl border border-stone-700/60 hover:border-emerald-500/40 text-stone-300 hover:text-white flex items-center justify-center gap-2 text-xs transition-all glass-panel-hover font-serif"
        >
          <RotateCcw size={13} />
          <span>恢复默认清静配置</span>
        </button>
      </div>
    </div>
  );
};
