import { useEffect, useMemo } from 'react';
import { useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useLoadingStore } from '../stores/useLoadingStore';

class SceneTextureLoader extends THREE.TextureLoader {
  override load(url: string, onLoad?: (texture: THREE.Texture) => void,
    onProgress?: (event: ProgressEvent) => void, onError?: (error: unknown) => void): THREE.Texture {
    useLoadingStore.getState().setTexture(url, 'loading');
    return super.load(url, texture => {
      useLoadingStore.getState().setTexture(url, 'ready');
      onLoad?.(texture);
    }, onProgress, error => {
      useLoadingStore.getState().setTexture(url, 'error', `无法读取 ${url}`);
      onError?.(error);
    });
  }
}

// Track every actual TextureLoader request, including loads that complete in
// one tick. A filename is never inferred from the latest global progress event.
export function useSceneTextures<T extends Record<string, string>>(input: T): Record<keyof T, THREE.Texture> {
  const gl = useThree(state => state.gl);
  const textures = useLoader(SceneTextureLoader, Object.values(input));
  const keys = Object.keys(input).join('|');
  const urls = Object.values(input);
  const signature = urls.join('\0');
  useEffect(() => {
    textures.forEach((texture, i) => {
      gl.initTexture(texture);
      // Cached hook results are already decoded too, even if no new request
      // occurs (for example after a development refresh or scene remount).
      if (useLoadingStore.getState().textures[urls[i]]?.status !== 'ready') {
        useLoadingStore.getState().setTexture(urls[i], 'ready');
      }
    });
  }, [gl, textures, signature]);
  return useMemo(() => Object.fromEntries(keys.split('|').map((key, i) => [key, textures[i]])) as Record<keyof T, THREE.Texture>, [keys, textures]);
}
