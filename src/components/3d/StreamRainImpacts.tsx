import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useAppStore } from '../../stores/useAppStore';
import { getStreamCenterX, getStreamHalfWidth, getTerrainHeight, STREAM_WATER_LEVEL, TERRAIN_SIZE } from '../../utils/terrain';
import { getStreamSurfaceHeight, type StreamDynamics } from '../../utils/streamDynamics';
import type { StreamRock } from './StreamRocks';

const POOL_SIZE = 160;
const NEAR_SPLASH_RADIUS = 4.5;
const DROPLETS_PER_IMPACT = 4;
interface Impact {
  born: number; z: number; across: number; duration: number;
  splash: boolean; seed: number; strength: number;
}

// Bounded, near-field crown sheets and ballistic droplets. The sheets have
// real curved walls and irregular raised lips; no flat ring overlays.
export const StreamRainImpacts: React.FC<{
  dynamics: React.MutableRefObject<StreamDynamics>; rocks: StreamRock[]; envMap: THREE.Texture;
}> = ({ dynamics, rocks, envMap }) => {
  const timeOfDay = useAppStore(state => state.timeOfDay);
  const crowns = useRef<THREE.InstancedMesh>(null);
  const spray = useRef<THREE.InstancedMesh>(null);
  const cursor = useRef(0), budget = useRef(0), lastUpdate = useRef(-1);
  const randomState = useRef(9017);
  const random = () => {
    randomState.current = (Math.imul(randomState.current, 1664525) + 1013904223) >>> 0;
    return randomState.current / 4294967296;
  };
  const events = useMemo<Impact[]>(() => Array.from({ length: POOL_SIZE }, () => ({
    born: -100, z: 0, across: 0, duration: 0.26, splash: false, seed: 0, strength: 0,
  })), []);
  const objects = useMemo(() => {
    const positions: number[] = [], uv: number[] = [], indices: number[] = [];
    const segments = 32, rows = 3;
    for (let row = 0; row <= rows; row++) {
      const v = row / rows;
      for (let i = 0; i <= segments; i++) {
        const theta = i / segments * Math.PI * 2;
        const lip = 0.75 + 0.16 * Math.sin(theta * 3 + 0.7) + 0.09 * Math.sin(theta * 7);
        const r = 0.42 + v * 0.58 + Math.sin(theta * 5) * 0.035 * v;
        positions.push(Math.cos(theta) * r, Math.pow(v, 1.65) * lip, Math.sin(theta) * r);
        uv.push(i / segments, v);
        if (row < rows && i < segments) {
          const a = row * (segments + 1) + i, b = a + segments + 1;
          indices.push(a, b, a + 1, a + 1, b, b + 1);
        }
      }
    }
    const crownGeometry = new THREE.BufferGeometry();
    crownGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    crownGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    crownGeometry.setIndex(indices); crownGeometry.computeVertexNormals();
    const visibility = new THREE.InstancedBufferAttribute(new Float32Array(POOL_SIZE), 1);
    visibility.setUsage(THREE.DynamicDrawUsage);
    crownGeometry.setAttribute('impactVisibility', visibility);
    const shape = new THREE.InstancedBufferAttribute(new Float32Array(POOL_SIZE * 2), 2);
    shape.setUsage(THREE.DynamicDrawUsage); crownGeometry.setAttribute('impactShape', shape);
    const crownMaterial = new THREE.MeshPhysicalMaterial({ color: '#708f82', roughness: 0.12,
      metalness: 0, ior: 1.333, envMap, envMapIntensity: 0.8, specularIntensity: 1,
      clearcoat: 0.8, clearcoatRoughness: 0.18,
      transparent: true, opacity: 0.60, depthWrite: false, side: THREE.DoubleSide });
    const skyBrightness = { value: 1 };
    crownMaterial.onBeforeCompile = shader => {
      shader.vertexShader = 'attribute float impactVisibility; attribute vec2 impactShape; varying float splashVisibility; varying float sheetHeight; varying vec3 splashShape;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        splashVisibility=impactVisibility; sheetHeight=uv.y; splashShape=vec3(uv.x*6.2831853,impactShape);`);
      shader.uniforms.crownSkyBrightness = skyBrightness;
      shader.fragmentShader = 'uniform float crownSkyBrightness; varying float splashVisibility; varying float sheetHeight; varying vec3 splashShape;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        float angle=splashShape.x,seed=splashShape.y,life=splashShape.z;
        // Each event is a different set of torn arcs, never a closed cup wall.
        float crest=0.20+0.80*pow(0.5+0.5*sin(angle*5.0+seed*40.0+sin(angle*3.0+seed*17.0)),2.0);
        float arcs=smoothstep(-0.2+life*0.65,0.35+life*0.65,sin(angle*2.0+seed*17.0)+0.6*sin(angle*5.0-seed*9.0));
        float tornEdge=1.0-smoothstep(crest-0.12,crest+0.02,sheetHeight);
        diffuseColor.a*=splashVisibility*arcs*tornEdge*smoothstep(0.0,0.35,sheetHeight);
        diffuseColor.rgb*=mix(0.65,1.15,sheetHeight);`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
        float sheetFacing=clamp(dot(normal,normalize(vViewPosition)),0.0,1.0);
        float sheetFresnel=pow(1.0-sheetFacing,3.0);
        outgoingLight=mix(outgoingLight,vec3(0.48,0.55,0.52)*crownSkyBrightness,0.12+0.55*sheetFresnel);
        diffuseColor.a*=0.60+0.40*sheetFresnel;
        #include <opaque_fragment>`);
    };
    crownMaterial.customProgramCacheKey = () => 'rain-broken-water-sheet-v3';
    const sprayGeometry = new THREE.SphereGeometry(1, 6, 4);
    const sprayMaterial = new THREE.MeshPhysicalMaterial({ color: '#abc2b8', roughness: 0.12,
      metalness: 0, ior: 1.333, envMap, envMapIntensity: 0.8,
      transparent: true, opacity: 0.75, depthWrite: false });
    // Sub-pixel drops need the broad overcast sky highlight, as on the water
    // itself; otherwise the forest cube makes every small droplet disappear.
    sprayMaterial.onBeforeCompile = shader => {
      shader.uniforms.dropSkyBrightness = skyBrightness;
      shader.fragmentShader = 'uniform float dropSkyBrightness;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
        float dropFacing=clamp(dot(normal,normalize(vViewPosition)),0.0,1.0);
        float glint=0.25+0.5*pow(1.0-dropFacing,2.0);
        outgoingLight=mix(outgoingLight,vec3(0.48,0.55,0.52)*dropSkyBrightness,glint);
        #include <opaque_fragment>`);
    };
    sprayMaterial.customProgramCacheKey = () => 'rain-drop-sky-glints-v1';
    return { crownGeometry, crownMaterial, visibility, shape, skyBrightness, sprayGeometry, sprayMaterial };
  }, [envMap]);
  useEffect(() => {
    const light = timeOfDay === 'night' ? 0.32 : timeOfDay === 'dusk' ? 0.65 : timeOfDay === 'dawn' ? 0.8 : 1;
    objects.sprayMaterial.color.set('#abc2b8').multiplyScalar(light);
    objects.crownMaterial.color.set('#708f82').multiplyScalar(light);
    objects.skyBrightness.value = light;
  }, [objects, timeOfDay]);
  const rockCells = useMemo(() => {
    const cells = new Map<string, StreamRock[]>();
    for (const rock of rocks) {
      for (let ix = Math.floor((rock.x - (rock.scale[0] + 0.055) * 1.05) / 2); ix <= Math.floor((rock.x + (rock.scale[0] + 0.055) * 1.05) / 2); ix++) {
        for (let iz = Math.floor((rock.z - (rock.scale[2] + 0.055) * 1.05) / 2); iz <= Math.floor((rock.z + (rock.scale[2] + 0.055) * 1.05) / 2); iz++) {
          const key = `${ix},${iz}`, entries = cells.get(key) ?? [];
          entries.push(rock); cells.set(key, entries);
        }
      }
    }
    return cells;
  }, [rocks]);
  const forward = useMemo(() => new THREE.Vector3(), []);
  const pose = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ camera }) => {
    if (!spray.current || !crowns.current) return;
    const state = dynamics.current;
    const dt = state.time - lastUpdate.current;
    if (lastUpdate.current >= 0 && dt < 1 / 30 - 0.000001) return;
    lastUpdate.current = state.time;
    camera.getWorldDirection(forward);
    const nearStream = Math.abs(camera.position.x - getStreamCenterX(camera.position.z)) < 10;
    budget.current += nearStream ? Math.min(dt, 0.1) * (state.waterImpactDensity * 90) : 0;
    budget.current = Math.min(budget.current, 24);
    while (budget.current >= 1) {
      budget.current -= 1;
      let point: { x: number; z: number; across: number } | null = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const z = camera.position.z + (random() - 0.5) * (NEAR_SPLASH_RADIUS * 2);
        if (Math.abs(z) > TERRAIN_SIZE / 2 - 0.25) continue;
        const side = random() < 0.5 ? -1 : 1;
        const across = random() * getStreamHalfWidth(z, side) * 0.75 * side, x = getStreamCenterX(z) + across;
        if ((x - camera.position.x) ** 2 + (z - camera.position.z) ** 2 > NEAR_SPLASH_RADIUS ** 2) continue;
        if ((x - camera.position.x) * forward.x + (z - camera.position.z) * forward.z < -0.75) continue;
        if (STREAM_WATER_LEVEL + state.levelRise - getTerrainHeight(x, z) < 0.035) continue;
        const blocked = rockCells.get(`${Math.floor(x / 2)},${Math.floor(z / 2)}`)?.some(rock => {
          const dx = (x - rock.x) / (rock.scale[0] + 0.055), dz = (z - rock.z) / (rock.scale[2] + 0.055);
          return dx * dx + dz * dz < 1.1 && rock.y + rock.scale[1] > STREAM_WATER_LEVEL + state.levelRise;
        });
        if (!blocked) { point = { x, z, across }; break; }
      }
      if (!point) continue;
      const item = events[cursor.current];
      item.born = state.time; item.z = point.z; item.across = point.across;
      item.duration = 0.26;
      item.strength = state.waterImpactStrength;
      item.seed = random();
      item.splash = random() < Math.min(0.85, state.waterImpactStrength * 0.4);
      cursor.current = (cursor.current + 1) % POOL_SIZE;
    }
    let sprayCount = 0, crownCount = 0;
    for (const item of events) {
      const age = state.time - item.born;
      if (age < 0 || age > item.duration) continue;
      const z = item.z + age * state.flowSpeed * 0.22;
      const x = getStreamCenterX(z) + item.across;
      if ((x - camera.position.x) ** 2 + (z - camera.position.z) ** 2 > NEAR_SPLASH_RADIUS ** 2) continue;
      const h = getStreamSurfaceHeight(x, z, state);
      if (item.splash && item.strength > 0.01 && age < 0.10 + item.seed * 0.07) {
        const phase = age / (0.10 + item.seed * 0.07);
        const rise = Math.sin(Math.PI * Math.pow(phase, 0.65));
        const force = Math.sqrt(item.strength);
        const radius = (0.014 + item.seed * 0.016 + phase * 0.014) * force;
        const height = (0.012 + item.seed * 0.014) * force * rise;
        pose.position.set(x, h - 0.001, z);
        pose.rotation.set(0, item.seed * Math.PI * 2, 0);
        pose.scale.set(radius, Math.max(0.0001, height), radius * (0.65 + item.seed * 0.6)); pose.updateMatrix();
        crowns.current.setMatrixAt(crownCount, pose.matrix);
        objects.shape.setXY(crownCount, item.seed, phase);
        objects.visibility.setX(crownCount++, Math.min(1, phase * 12) * (1 - phase * phase));
      }
      if (item.splash && age < 0.24 && (x - camera.position.x) ** 2 + (z - camera.position.z) ** 2 < NEAR_SPLASH_RADIUS ** 2) {
        for (let particle = 0; particle < DROPLETS_PER_IMPACT; particle++) {
          const velocity = (0.52 + ((item.seed * 7 + particle * 0.37) % 1) * 0.38) * Math.sqrt(item.strength), elevation = velocity * age - 4.9 * age * age;
          if (elevation <= 0) continue;
          const angle = item.seed * Math.PI * 2 + particle * 2.399963;
          const spread = 0.14 + ((item.seed * 3 + particle * 0.31) % 1) * 0.24;
          pose.position.set(x + Math.cos(angle) * age * spread, h + 0.004 + elevation, z + Math.sin(angle) * age * spread);
          pose.quaternion.identity(); const size = 0.0020 + ((item.seed * 11 + particle * 0.27) % 1) * 0.0020;
          pose.scale.set(size, size * 1.7, size); pose.updateMatrix();
          spray.current.setMatrixAt(sprayCount++, pose.matrix);
        }
      }
    }
    crowns.current.count = crownCount;
    crowns.current.instanceMatrix.needsUpdate = true; objects.visibility.needsUpdate = true; objects.shape.needsUpdate = true;
    spray.current.count = sprayCount;
    spray.current.instanceMatrix.needsUpdate = true;
  });
  useEffect(() => {
    spray.current!.count = 0; crowns.current!.count = 0;
    crowns.current!.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    spray.current!.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    return () => { objects.sprayGeometry.dispose(); objects.sprayMaterial.dispose(); objects.crownGeometry.dispose(); objects.crownMaterial.dispose(); };
  }, [objects]);
  return <group>
    <instancedMesh ref={crowns} renderOrder={2} args={[objects.crownGeometry, objects.crownMaterial, POOL_SIZE]} frustumCulled={false} />
    <instancedMesh ref={spray} renderOrder={3} args={[objects.sprayGeometry, objects.sprayMaterial, POOL_SIZE * DROPLETS_PER_IMPACT]} frustumCulled={false} />
  </group>;
};
