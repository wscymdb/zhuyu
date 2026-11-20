import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { BambooForest } from './BambooForest';
import { Pavilion } from './Pavilion';
import { Stream } from './Stream';
import { RainSystem } from './RainSystem';
import { CameraController } from './CameraController';
import { Environment } from './Environment';
import { SceneReady } from './SceneReady';
import { useLoadingStore } from '../../stores/useLoadingStore';

class SceneBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { useLoadingStore.getState().setSceneError(error.message); }
  render() { return this.state.failed ? null : this.props.children; }
}

export const Scene: React.FC = () => {
  return (
    <div className="absolute inset-0 w-full h-full">
      <SceneBoundary>
      <Canvas
        shadows
        onCreated={({ gl }) => {
          gl.debug.onShaderError = (context, program, vertexShader, fragmentShader) => {
            const detail = context.getProgramInfoLog(program) || context.getShaderInfoLog(vertexShader)
              || context.getShaderInfoLog(fragmentShader) || '着色器编译失败';
            useLoadingStore.getState().setSceneError(detail);
          };
        }}
        dpr={[1, 1.5]}
        camera={{ position: [2.2, 1.35, -0.2], fov: 60, near: 0.1, far: 80 }}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
        }}
      >
        <Suspense fallback={null}>
          <Environment />
          <CameraController />
          <Pavilion />
          <Stream />
          <BambooForest />
          <RainSystem />
          <SceneReady />
        </Suspense>
      </Canvas>
      </SceneBoundary>
    </div>
  );
};
