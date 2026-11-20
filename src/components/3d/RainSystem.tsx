import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useAppStore } from '../../stores/useAppStore';
import { getTerrainHeight, getStreamCenterX, getStreamHalfWidth, PAVILION_POS } from '../../utils/terrain';

const RAIN_COUNT = 3800, EAVES_COUNT = 120, RIPPLE_COUNT = 160;
const WEATHER = {
  light: { speed: 0.65, slant: -0.10, opacity: 0.35 },
  moderate: { speed: 1, slant: -0.16, opacity: 0.48 },
  heavy: { speed: 1.35, slant: -0.22, opacity: 0.60 },
  storm: { speed: 1.8, slant: -0.32, opacity: 0.72 },
  thunder: { speed: 2.15, slant: -0.38, opacity: 0.76 },
};

export const RainSystem: React.FC = () => {
  const rippleMesh = useRef<THREE.InstancedMesh>(null);
  const rainType = useAppStore(state => state.rainType);
  const intensity = useAppStore(state => state.config.rainIntensity);
  const objects = useMemo(() => {
    const travel = { value: 0 }, windTravel = { value: 0 }, slant = { value: -0.1 };
    const geometry = new THREE.BufferGeometry();
    const origins: number[] = [], motion: number[] = [], positions: number[] = [];
    for (let i = 0; i < RAIN_COUNT + EAVES_COUNT; i++) {
      const eaves = i >= RAIN_COUNT;
      let x = (Math.random() - 0.5) * 45, z = (Math.random() - 0.5) * 45, top = 25;
      if (eaves) {
        const angle = Math.floor(Math.random() * 4) * Math.PI / 2, t = Math.random() * 2 - 1;
        x = PAVILION_POS[0] + 4.15 * (t * Math.cos(angle) + Math.sin(angle));
        z = PAVILION_POS[2] + 4.15 * (Math.cos(angle) - t * Math.sin(angle));
        top = 3.61 + 0.2 * Math.pow(Math.abs(t), 6);
      }
      const speed = eaves ? 8.5 + Math.random() * 4 : 28 + Math.random() * 14;
      const length = eaves ? 0.035 + Math.random() * 0.045 : 0.10 + Math.random() * 0.13;
      const phase = Math.random();
      for (let end = 0; end < 2; end++) {
        positions.push(0, end, 0); origins.push(x, top, z);
        motion.push(speed, length, phase, eaves ? 1 : 0);
      }
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('rainOrigin', new THREE.Float32BufferAttribute(origins, 3));
    geometry.setAttribute('rainMotion', new THREE.Float32BufferAttribute(motion, 4));
    const material = new THREE.LineBasicMaterial({ color: '#dbebe3', transparent: true, opacity: 0.48, depthWrite: false });
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, { rainTravel: travel, rainWindTravel: windTravel, rainSlant: slant });
      shader.vertexShader = `uniform float rainTravel; uniform float rainWindTravel; uniform float rainSlant;
        attribute vec3 rainOrigin; attribute vec4 rainMotion; varying float rainVisibility;\n` + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
        float eaves=rainMotion.w;
        float headY=rainOrigin.y-mod(rainMotion.z*rainOrigin.y+rainTravel*rainMotion.x,rainOrigin.y);
        float x=mix(mod(rainOrigin.x+rainWindTravel*rainMotion.x+22.5,45.0)-22.5,rainOrigin.x,eaves);
        float localX=abs(x-${PAVILION_POS[0].toFixed(2)}),localZ=abs(rainOrigin.z-${PAVILION_POS[2].toFixed(2)});
        float radius=max(localX,localZ)/4.15;
        float corner=min(localX,localZ)/max(0.001,max(localX,localZ));
        float roofY=3.6+1.9*pow(max(0.0,1.0-radius),1.45)+pow(min(radius,1.0),5.0)*(0.07+0.2*pow(corner,6.0));
        float sheltered=(1.0-step(1.0,radius))*(1.0-step(roofY+0.03,headY));
        rainVisibility=(1.0-sheltered*(1.0-eaves))*step(0.05,headY);
        vec3 head=vec3(x,headY,rainOrigin.z);
        rainVisibility*=smoothstep(0.5,1.3,distance(head,cameraPosition));
        vec3 transformed=head+vec3(-rainSlant*(1.0-eaves),1.0,0.0)*rainMotion.y*position.y;
      `);
      shader.fragmentShader = 'varying float rainVisibility;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.a*=rainVisibility;');
    };
    material.customProgramCacheKey = () => 'gpu-short-rain-v1';
    const rippleGeometry = new THREE.RingGeometry(0.02, 0.07, 18); rippleGeometry.rotateX(-Math.PI / 2);
    const rippleMotion = new Float32Array(RIPPLE_COUNT * 3), centers: THREE.Vector3[] = [];
    for (let i = 0; i < RIPPLE_COUNT; i++) {
      const x = (Math.random() - 0.5) * 38, z = (Math.random() - 0.5) * 38;
      const hidden = (Math.abs(x - PAVILION_POS[0]) < 4.15 && Math.abs(z - PAVILION_POS[2]) < 4.15)
        || Math.abs(x - getStreamCenterX(z)) < getStreamHalfWidth(z, x < getStreamCenterX(z) ? -1 : 1);
      centers.push(new THREE.Vector3(x, getTerrainHeight(x, z) + 0.012, z));
      rippleMotion.set([Math.random(), 1 + Math.random() * 0.7, hidden ? 0 : 0.7 + Math.random() * 0.7], i * 3);
    }
    rippleGeometry.setAttribute('rippleMotion', new THREE.InstancedBufferAttribute(rippleMotion, 3));
    const rippleMaterial = new THREE.MeshBasicMaterial({ color: '#9ec4b5', transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
    rippleMaterial.onBeforeCompile = shader => {
      shader.uniforms.rainTravel = travel;
      shader.vertexShader = 'uniform float rainTravel; attribute vec3 rippleMotion; varying float rippleFade;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
        float life=fract(rippleMotion.x+rainTravel*rippleMotion.y);
        rippleFade=(1.0-life)*(1.0-life);
        vec3 transformed=position*(0.02+life)*rippleMotion.z;`);
      shader.fragmentShader = 'varying float rippleFade;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.a*=rippleFade;');
    };
    rippleMaterial.customProgramCacheKey = () => 'gpu-ground-ripples-v1';
    return { geometry, material, travel, windTravel, slant, rippleGeometry, rippleMaterial, centers };
  }, []);
  useLayoutEffect(() => {
    const matrix = new THREE.Matrix4();
    objects.centers.forEach((point, i) => { matrix.makeTranslation(point.x, point.y, point.z); rippleMesh.current!.setMatrixAt(i, matrix); });
    rippleMesh.current!.instanceMatrix.needsUpdate = true;
    rippleMesh.current!.computeBoundingSphere();
  }, [objects]);
  useFrame((_, delta) => {
    const weather = WEATHER[rainType], dt = Math.min(delta, 0.1) * weather.speed * intensity;
    objects.travel.value += dt;
    objects.windTravel.value += dt * weather.slant;
    objects.slant.value = weather.slant;
    objects.material.opacity = weather.opacity;
  });
  useEffect(() => () => {
    objects.geometry.dispose(); objects.material.dispose(); objects.rippleGeometry.dispose(); objects.rippleMaterial.dispose();
  }, [objects]);
  return <group>
    <lineSegments geometry={objects.geometry} material={objects.material} frustumCulled={false} />
    <instancedMesh ref={rippleMesh} args={[objects.rippleGeometry, objects.rippleMaterial, RIPPLE_COUNT]} />
  </group>;
};
