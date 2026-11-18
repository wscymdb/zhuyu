import React from 'react';
import { Scene } from './components/3d/Scene';
import { PoemOverlay } from './components/ui/PoemOverlay';
import { Controls } from './components/ui/Controls';
import { SettingsPanel } from './components/ui/SettingsPanel';
import { LoadingScreen } from './components/ui/LoadingScreen';

export const App: React.FC = () => {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-stone-950 font-serif">
      {/* 3D 渲染主画布 */}
      <Scene />

      {/* 游戏级国风开篇加载页 (实时进度 + 资源名 + 点击入静开音效) */}
      <LoadingScreen />

      {/* 悬浮国风诗词卡片 */}
      <PoemOverlay />

      {/* 交互控制台与音频开关 */}
      <Controls />

      {/* 境象调控面板 (配置抽屉) */}
      <SettingsPanel />
    </div>
  );
};

export default App;
