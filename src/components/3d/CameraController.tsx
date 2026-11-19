import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useAppStore } from '../../stores/useAppStore';
import { CameraViewType } from '../../types';
import { soundEngine } from '../../utils/audioSynthesizer';

interface ViewConfig {
  pos: [number, number, number];
  target: [number, number, number];
}

const VIEW_CONFIGS: Record<Exclude<CameraViewType, 'free'>, ViewConfig> = {
  // 1. 亭内独坐听雨 (岸上木亭凭栏，案前抚琴俯瞰左前方溪谷)
  pavilion: {
    pos: [2.2, 1.35, -0.2],
    target: [-2.5, 0.9, 3.5],
  },
  // 2. 临溪听泉 (置身溪畔石阶，近观清溪流淌)
  stream: {
    pos: [-3.25, 1.8, -2.0],
    target: [-5.2, -0.15, 1.4],
  },
  // 3. 幽篁深处 (竹林缓坡仰望山林与木亭飞檐)
  bamboo: {
    pos: [11.5, 3.4, 11.5],
    target: [2.2, 2.4, 0.5],
  },
  // 4. 全景鸟瞰 (俯瞰岸上木亭、蜿蜒溪流与层峦竹海)
  overview: {
    pos: [13.5, 10.5, 14.5],
    target: [0, 1.0, 0],
  },
};

export const CameraController: React.FC = () => {
  const camera = useThree((state) => state.camera);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const cameraView = useAppStore((state) => state.cameraView);
  const setCameraView = useAppStore((state) => state.setCameraView);
  const isAutoRotate = useAppStore((state) => state.isAutoRotate);
  const config = useAppStore((state) => state.config);

  const targetPos = useRef(new THREE.Vector3(...VIEW_CONFIGS.pavilion.pos));
  const targetLook = useRef(new THREE.Vector3(...VIEW_CONFIGS.pavilion.target));
  const isTransitioning = useRef(false);
  const lastInPavilion = useRef(true);

  // 监听键盘按键 (WASD / 方向键) 实现自由漫游行走
  const keysPressed = useRef<{ [key: string]: boolean }>({});

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // 当外部点击切换机位时，启动平滑过渡
  useEffect(() => {
    if (cameraView === 'free') {
      isTransitioning.current = false;
      return;
    }

    const cfg = VIEW_CONFIGS[cameraView];
    if (cfg) {
      targetPos.current.set(...cfg.pos);
      targetLook.current.set(...cfg.target);
      isTransitioning.current = true;
    }
  }, [cameraView]);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    // 动态检测相机是否身处听雨亭内，实时无缝切换声学生态
    const distToPavilion = Math.hypot(camera.position.x - 2.2, camera.position.z - 0.5);
    const inPavilion = cameraView === 'pavilion' || (cameraView === 'free' && distToPavilion < 3.2);
    if (lastInPavilion.current !== inPavilion) {
      lastInPavilion.current = inPavilion;
      soundEngine.setInPavilion(inPavilion);
    }

    // 1. 处于预设机位过渡动画时：平滑插值移动
    if (isTransitioning.current && cameraView !== 'free') {
      const factor = Math.min(1, delta * 3.5);
      camera.position.lerp(targetPos.current, factor);
      controls.target.lerp(targetLook.current, factor);
      controls.update();

      // 当已经非常接近目标位置时，解除强行锁定，允许用户自由接管
      const dist = camera.position.distanceTo(targetPos.current);
      if (dist < 0.05) {
        isTransitioning.current = false;
      }
      return;
    }

    // 2. 自由漫游模式：支持键盘 WASD 键平移相机位置
    const speed = config.moveSpeed * delta;
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();

    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    right.crossVectors(forward, camera.up).normalize();

    let moved = false;
    const keys = keysPressed.current;

    if (keys['w'] || keys['arrowup']) {
      camera.position.addScaledVector(forward, speed);
      controls.target.addScaledVector(forward, speed);
      moved = true;
    }
    if (keys['s'] || keys['arrowdown']) {
      camera.position.addScaledVector(forward, -speed);
      controls.target.addScaledVector(forward, -speed);
      moved = true;
    }
    if (keys['a'] || keys['arrowleft']) {
      camera.position.addScaledVector(right, -speed);
      controls.target.addScaledVector(right, -speed);
      moved = true;
    }
    if (keys['d'] || keys['arrowright']) {
      camera.position.addScaledVector(right, speed);
      controls.target.addScaledVector(right, speed);
      moved = true;
    }

    // 限制相机高度不要穿入地底
    if (camera.position.y < 0.4) {
      camera.position.y = 0.4;
    }

    if (moved) {
      if (cameraView !== 'free') {
        setCameraView('free');
      }
      controls.update();
    }
  });

  // 当用户用鼠标拖拽相机时，自动切换为自由视角状态
  const handleUserStart = () => {
    isTransitioning.current = false;
    if (cameraView !== 'free') {
      setCameraView('free');
    }
  };

  return (
    <OrbitControls
      ref={controlsRef}
      onStart={handleUserStart}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={config.rotateSpeed}
      zoomSpeed={config.zoomSpeed}
      panSpeed={0.8}
      minDistance={0.5}
      maxDistance={45}
      maxPolarAngle={Math.PI / 2 + 0.05} // 防止相机翻入地底
      autoRotate={isAutoRotate}
      autoRotateSpeed={0.6}
    />
  );
};
