import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { BambooForest } from './BambooForest';
import { Pavilion } from './Pavilion';
import { Stream } from './Stream';
import { RainSystem } from './RainSystem';
import { CameraController } from './CameraController';
import { Environment } from './Environment';

export const Scene: React.FC = () => {
  return (
    <div className="absolute inset-0 w-full h-full">
      <Canvas
        shadows
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
        </Suspense>
      </Canvas>
    </div>
  );
};
