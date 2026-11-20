import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { useLoadingStore, rainAudioKey, RAIN_AUDIO_SOURCES, type AssetStatus } from '../../stores/useLoadingStore';
import { soundEngine } from '../../utils/audioSynthesizer';

const RAIN_LABELS = { light: '小雨', moderate: '中雨', heavy: '大雨', storm: '暴雨', thunder: '雷雨' };
const STATUS_LABELS: Record<AssetStatus, string> = { loading: '下载中', decoding: '解码中', ready: '已准备', error: '失败' };
function filename(path: string) { return path.split('/').pop() || path; }

export const LoadingScreen: React.FC = () => {
  const rainType = useAppStore(state => state.rainType);
  const textures = useLoadingStore(state => state.textures);
  const audio = useLoadingStore(state => state.audio);
  const sceneReady = useLoadingStore(state => state.sceneReady);
  const sceneError = useLoadingStore(state => state.sceneError);
  const [hasEntered, setHasEntered] = useState(false);
  const [entering, setEntering] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const entries = Object.entries(textures);
  const loaded = entries.filter(([, asset]) => asset.status === 'ready').length;
  const textureErrors = entries.filter(([, asset]) => asset.status === 'error');
  const total = entries.length;
  const texturesReady = total > 0 && loaded === total;
  const selectedAudio = audio[rainAudioKey(rainType)];
  const audioReady = selectedAudio?.status === 'ready';
  const canEnterScene = texturesReady && sceneReady && !sceneError;
  const canEnterWithSound = canEnterScene && audioReady;

  useEffect(() => {
    if (hasEntered) return;
    setPlaybackError(null);
    void soundEngine.prepareRainAudio(rainType).catch(() => { /* Per-file status is shown below. */ });
  }, [rainType, hasEntered]);

  const handleEnter = async (withSound: boolean) => {
    if (entering || !canEnterScene || (withSound && !audioReady)) return;
    setEntering(true);
    try {
      if (withSound) {
        const state = useAppStore.getState();
        soundEngine.setRainType(state.rainType);
        soundEngine.setInPavilion(state.cameraView === 'pavilion');
        await soundEngine.startAmbience();
        if (!soundEngine.isAudioRunning()) throw new Error('浏览器未能开启声音，请重试或静音进入。');
        useAppStore.setState({ isAudioPlaying: true });
      } else {
        soundEngine.stopAmbience();
        useAppStore.setState({ isAudioPlaying: false });
        void soundEngine.preloadBackgroundAudio();
      }
      setHasEntered(true);
    } catch (error) {
      soundEngine.stopAmbience();
      useAppStore.setState({ isAudioPlaying: false });
      setPlaybackError(error instanceof Error ? error.message : '无法开启声音，可静音进入。');
    } finally {
      setEntering(false);
    }
  };

  if (hasEntered) return null;

  const audioText = !selectedAudio ? '等待准备' : selectedAudio.status === 'ready'
    ? RAIN_AUDIO_SOURCES[rainType] ? '录音已解码' : '合成雨声已准备'
    : selectedAudio.status === 'loading' ? RAIN_AUDIO_SOURCES[rainType] ? '下载录音中' : '生成雨声中'
    : selectedAudio.status === 'decoding' ? '解码录音中' : '准备失败';
  const rowClass = 'flex items-center justify-between gap-3 text-xs';
  const buttonClass = 'px-6 py-3 rounded-full border border-emerald-500/50 bg-emerald-950/40 text-emerald-100 hover:bg-emerald-900/60 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait';

  return <div className="fixed inset-0 z-50 flex flex-col items-center justify-between select-none overflow-y-auto"
    style={{ background: 'radial-gradient(circle at center, #141c18 0%, #0c100e 65%, #060908 100%)' }}>
    <div className="pt-8 md:pt-12 text-center">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-900/60 bg-emerald-950/40">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-xs tracking-widest text-emerald-200/80 font-serif">WEB 3D ZEN SPACE</span>
      </div>
    </div>
    <div className="flex flex-col items-center text-center px-6 py-8">
      <div className="w-9 h-9 mb-4 rounded-sm border border-red-700/80 bg-red-900/40 text-red-300 flex items-center justify-center text-xs font-serif">禅境</div>
      <h1 className="text-4xl md:text-5xl font-serif tracking-[0.3em] text-stone-100 mb-4 ml-3">听雨 · 幽篁</h1>
      <p className="text-sm md:text-base text-stone-400 tracking-[0.25em] font-serif leading-relaxed">独坐幽篁里，弹琴复长啸。深林人不知，明月来相照。</p>
    </div>
    <div className="w-full max-w-md px-8 pb-8 md:pb-12 flex flex-col items-center gap-4">
      <div className="w-full space-y-3" aria-live="polite">
        <div className={rowClass}><span className="text-stone-400">场景贴图</span>
          <span className={texturesReady ? 'text-emerald-300' : 'text-stone-300'}>
            {total === 0 ? '等待资源请求' : `${loaded} / ${total} 项${textureErrors.length ? ` · ${textureErrors.length} 项失败` : texturesReady ? ' · 已读取' : ' · 加载中'}`}
          </span>
        </div>
        <div className="h-1 w-full rounded-full bg-stone-800 overflow-hidden" role="progressbar" aria-label="贴图读取进度"
          aria-valuemin={0} aria-valuemax={total || undefined} aria-valuenow={total ? loaded : undefined}>
          <div className="h-full bg-emerald-500" style={{ width: total ? `${loaded / total * 100}%` : '0%' }} />
        </div>
        <div className={rowClass}><span className="text-stone-400">准备场景</span>
          <span className={sceneError ? 'text-red-300' : sceneReady ? 'text-emerald-300' : 'text-stone-300'}>{sceneError ? '绘制失败' : sceneReady ? '首帧已绘制' : texturesReady ? '绘制首帧中' : '等待贴图'}</span>
        </div>
        <div className={rowClass}><span className="text-stone-400">{RAIN_LABELS[rainType]}雨声</span>
          <span className={selectedAudio?.status === 'error' ? 'text-red-300' : audioReady ? 'text-emerald-300' : 'text-stone-300'}>{audioText}</span>
        </div>
      </div>
      <details className="w-full text-[11px] text-stone-500" open={textureErrors.length > 0 || !!sceneError}>
        <summary className="cursor-pointer hover:text-stone-300">资源明细 · 贴图按文件数量统计</summary>
        <ul className="mt-2 max-h-[22vh] overflow-y-auto space-y-1.5">
          {entries.map(([url, asset]) => <li key={url} className="flex justify-between gap-3" title={url}>
            <span className="truncate">{filename(url)}</span><span className={asset.status === 'error' ? 'text-red-300' : ''}>{asset.status === 'ready' ? '已读取' : STATUS_LABELS[asset.status]}</span>
          </li>)}
          <li className="flex justify-between gap-3" title={rainAudioKey(rainType)}><span className="truncate">{RAIN_AUDIO_SOURCES[rainType] ? filename(rainAudioKey(rainType)) : '程序合成雨声（无需下载）'}</span><span>{audioText}</span></li>
        </ul>
      </details>
      {(sceneError || textureErrors.length > 0) && <div className="text-center text-xs text-red-300 space-y-2">
        <p>场景资源未能准备完成。</p><button onClick={() => window.location.reload()} className="underline cursor-pointer">重新加载页面</button>
      </div>}
      {(selectedAudio?.status === 'error' || playbackError) && <div className="text-center text-xs text-amber-200/80 space-y-2">
        <p>{playbackError || '雨声准备失败，可重试或先静音进入。'}</p>
        {selectedAudio?.status === 'error' && <button className="underline cursor-pointer" onClick={() => { void soundEngine.prepareRainAudio(rainType).catch(() => {}); }}>重试雨声</button>}
      </div>}
      {canEnterWithSound && <button onClick={() => { void handleEnter(true); }} disabled={entering} className={buttonClass}>
        <span className="text-base tracking-[0.3em] font-serif">{entering ? '正在开启雨声…' : playbackError ? '重试开启雨声' : '点击入境 · 抚琴听雨'}</span>
      </button>}
      {canEnterScene && (!audioReady || playbackError) && <button onClick={() => { void handleEnter(false); }} disabled={entering}
        className="text-xs text-stone-300 underline cursor-pointer disabled:opacity-50">先静音进入</button>}
      {canEnterWithSound && <span className="text-[11px] text-stone-500 tracking-widest">轻触开启雨声</span>}
    </div>
  </div>;
};
