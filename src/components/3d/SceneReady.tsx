import { useEffect, useRef } from 'react';
import { addAfterEffect, useFrame, useThree } from '@react-three/fiber';
import { useLoadingStore } from '../../stores/useLoadingStore';

// This component commits with the full Suspense scene, then waits until its
// first frame has passed through the renderer, including initial GPU uploads.
export function SceneReady() {
  const gl = useThree(state => state.gl);
  const armed = useRef(false);
  useFrame(() => { armed.current = true; });
  useEffect(() => {
    armed.current = false;
    useLoadingStore.getState().setSceneReady(false);
    const unsubscribe = addAfterEffect(() => {
      if (useLoadingStore.getState().sceneError) { unsubscribe(); return; }
      if (!armed.current || gl.getContext().isContextLost()) return;
      useLoadingStore.getState().setSceneReady(true);
      unsubscribe();
    });
    return unsubscribe;
  }, [gl]);
  return null;
}
