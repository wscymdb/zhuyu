import React from 'react';
import { useAppStore, POEMS } from '../../stores/useAppStore';
import { RefreshCw, BookOpen, Volume2 } from 'lucide-react';
import { soundEngine } from '../../utils/audioSynthesizer';

export const PoemOverlay: React.FC = () => {
  const currentPoemIndex = useAppStore((state) => state.currentPoemIndex);
  const showPoem = useAppStore((state) => state.showPoem);
  const nextPoem = useAppStore((state) => state.nextPoem);
  const togglePoem = useAppStore((state) => state.togglePoem);

  const poem = POEMS[currentPoemIndex];

  if (!showPoem) {
    return (
      <button
        onClick={togglePoem}
        className="fixed top-6 left-6 z-20 glass-panel px-3.5 py-2 rounded-full text-stone-300 hover:text-white flex items-center gap-2 text-sm transition-all"
        title="展开诗词"
      >
        <BookOpen size={16} />
        <span>读诗</span>
      </button>
    );
  }

  const handleGuqinPlay = () => {
    soundEngine.playGuqinString();
  };

  return (
    <div className="fixed top-6 left-6 z-20 max-w-xs animate-ink pointer-events-auto">
      <div className="glass-panel p-5 rounded-2xl shadow-2xl relative border border-emerald-900/30">
        {/* 顶部控制栏 */}
        <div className="flex items-center justify-between text-stone-400 text-xs mb-3 border-b border-stone-800/80 pb-2.5">
          <span className="tracking-widest font-serif text-emerald-400/90 font-medium">
            〔 {poem.dynasty} · {poem.author} 〕
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleGuqinPlay}
              className="p-1 hover:text-emerald-300 transition-colors"
              title="轻触抚琴"
            >
              <Volume2 size={14} />
            </button>
            <button
              onClick={nextPoem}
              className="p-1 hover:text-emerald-300 transition-colors"
              title="切换诗篇"
            >
              <RefreshCw size={14} />
            </button>
            <button
              onClick={togglePoem}
              className="p-1 hover:text-stone-200 transition-colors"
              title="收起"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 诗名 */}
        <h2 className="text-xl font-serif text-stone-100 tracking-wider mb-4 font-semibold text-center">
          {poem.title}
        </h2>

        {/* 诗词正文 (东方竖排排版灵感，这里用竖向优雅分行居中) */}
        <div className="space-y-2 text-center text-stone-200 font-serif tracking-widest text-base leading-relaxed py-1">
          {poem.lines.map((line, idx) => (
            <p key={idx} className="transition-all hover:text-emerald-300 cursor-default">
              {line}
            </p>
          ))}
        </div>

        {/* 底部微小交互贴士 */}
        <div className="mt-4 pt-2.5 border-t border-stone-800/60 text-[11px] text-stone-400/80 text-center flex justify-center items-center gap-1.5">
          <span>点击画面中古琴可抚琴</span>
          <span>·</span>
          <span>点击小溪激起涟漪</span>
        </div>
      </div>
    </div>
  );
};
