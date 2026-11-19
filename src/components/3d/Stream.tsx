import React, { useRef, useMemo, useLayoutEffect, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useCubeCamera } from '@react-three/drei';
import { useAppStore } from '../../stores/useAppStore';
import { soundEngine } from '../../utils/audioSynthesizer';
import { createWaterNormalTexture } from '../../utils/natureTextureGenerator';
import { getTerrainHeight, getStreamCenterX, TERRAIN_SIZE, STREAM_SURFACE_HALF_WIDTH,
  STREAM_CHANNEL_HALF_WIDTH, STREAM_WATER_LEVEL } from '../../utils/terrain';
import { advanceStream, createStreamDynamics, getStreamConditions, getStreamSurfaceHeight,
  STREAM_WAVE_GLSL, type StreamDynamics } from '../../utils/streamDynamics';
import { StreamRocks, type StreamRock } from './StreamRocks';
import { StreamLife } from './StreamLife';
import { StreamRainImpacts } from './StreamRainImpacts';

type DynamicsRef = React.MutableRefObject<StreamDynamics>;
// Height and its analytic derivatives drive both geometry and lighting. The
// millimetre waves have a trough and a crest, rather than a coloured ring.
const STREAM_RAIN_GLSL = `
  float streamDropHash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  vec3 streamRainField(vec2 point) {
    float distanceFade=1.0-smoothstep(9.0,17.0,distance(point,cameraPosition.xz));
    if(distanceFade<0.001) return vec3(0.0);
    vec2 slope=vec2(0.0);
    float height=0.0;
    // Above the original density range, increase spatial event frequency as
    // well as coverage. Keep the shader at four layers at every slider value.
    float spatialScale=sqrt(1.0+max(0.0,rainCoverage-2.5)*1.5);
    for(int i=0;i<4;i++) {
      float layer=float(i);
      float layerWeight=smoothstep(layer,layer+1.0,rainCoverage*1.3);
      if(layerWeight<0.001) continue;
      vec2 cellUv=point*(2.0*spatialScale)+vec2(layer*0.37,layer*0.61);
      vec2 cell=floor(cellUv),f=fract(cellUv);
      float timingSeed=streamDropHash(cell+layer*17.3);
      float tick=streamTime*(0.75+timingSeed*0.35)*(1.0+max(0.0,rainCoverage-2.5)*0.12)+timingSeed;
      float age=fract(tick),epoch=floor(tick);
      float seed=streamDropHash(cell+vec2(epoch*17.1,epoch*31.7)+layer*3.1);
      float dropMask=(1.0-smoothstep(0.60,0.70,seed))*layerWeight;
      vec2 offset=(f-(vec2(0.5)+(vec2(seed,fract(seed*7.1))-0.5)*0.12))/2.0;
      float r=length(offset);
      float front=0.025+age*0.20;
      float q=r-front;
      float width=0.035+age*0.018;
      float packet=exp(-q*q/(width*width));
      float phase=q*105.0;
      float amplitude=(rainImpact*0.0055)*exp(-age*2.8)*smoothstep(0.0,0.055,age)*dropMask;
      // The compact support and its derivative reach zero before cell edges.
      float t=clamp((r-0.17)/0.045,0.0,1.0);
      float edge=1.0-t*t*(3.0-2.0*t);
      float edgeSlope=-6.0*t*(1.0-t)/0.045;
      float wave=amplitude*packet*cos(phase);
      float derivative=amplitude*packet*(-105.0*sin(phase)-2.0*q/(width*width)*cos(phase));
      float dimple=-(rainImpact*0.007)*exp(-r*r/0.0007)*(1.0-smoothstep(0.0,0.20,age))*dropMask;
      height+=wave*edge+dimple;
      slope+=spatialScale*offset/max(r,0.0001)*(derivative*edge+wave*edgeSlope-dimple*2.0*r/0.0007);
    }
    // Overlapping short waves break up the untouched gaps between impacts.
    // Use analytic slopes here as well, so geometry and shading agree.
    float chop=(rainImpact*0.0035)*smoothstep(0.0,1.4,rainCoverage)*(1.0+max(0.0,rainCoverage-2.5)*0.15);
    vec2 p=point-vec2(0.08,0.18)*streamTime;
    float a=dot(p,vec2(23.0,17.0)),b=dot(p,vec2(-19.0,29.0)),c=dot(p,vec2(31.0,-11.0));
    height+=chop*(sin(a)+sin(b)*0.65+sin(c)*0.4);
    slope+=chop*(cos(a)*vec2(23.0,17.0)+cos(b)*vec2(-19.0,29.0)*0.65+cos(c)*vec2(31.0,-11.0)*0.4);
    // Bound overlapping storm waves; apply the same derivative to the normals.
    float compression=1.0+abs(height)/0.035;
    return vec3(slope/(compression*compression),height/compression)*distanceFade;
  }
`;

interface LeafItem { z: number; across: number; speed: number; angle: number; spin: number; scale: number; color: string }

const DriftingLeaves: React.FC<{ dynamics: DynamicsRef }> = ({ dynamics }) => {
  const group = useRef<THREE.Group>(null);
  const leaves = useMemo<LeafItem[]>(() => {
    let seed = 2491;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const colors = ['#5e784a', '#6f8057', '#576344', '#81744b', '#8a7d52'];
    return Array.from({ length: 18 }, (_, i) => ({ z: -TERRAIN_SIZE / 2 + (i + 0.5) / 18 * TERRAIN_SIZE,
      across: (random() - 0.5) * 1.65, speed: 0.88 + random() * 0.24,
      angle: random() * Math.PI * 2, spin: (random() - 0.5) * 0.12,
      scale: 0.55 + random() * 0.35, color: colors[i % colors.length] }));
  }, []);
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.16); shape.quadraticCurveTo(0.032, 0.04, 0.018, -0.14);
    shape.quadraticCurveTo(0, -0.2, 0, -0.2); shape.quadraticCurveTo(0, -0.14, -0.018, -0.14);
    shape.quadraticCurveTo(-0.032, 0.04, 0, 0.16);
    const geo = new THREE.ShapeGeometry(shape); geo.rotateX(-Math.PI / 2); return geo;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame((_, delta) => {
    if (!group.current) return;
    const state = dynamics.current, dt = Math.min(delta, 0.1);
    leaves.forEach((leaf, i) => {
      leaf.z += dt * state.flowSpeed * leaf.speed;
      if (leaf.z > TERRAIN_SIZE / 2 - 1) leaf.z = -TERRAIN_SIZE / 2 + 1;
      leaf.angle += dt * leaf.spin * (0.6 + state.rainImpact * 0.4);
      const x = getStreamCenterX(leaf.z) + leaf.across;
      const object = group.current!.children[i];
      object.position.set(x, getStreamSurfaceHeight(x, leaf.z, state) + 0.004, leaf.z);
      object.rotation.set(
        (getStreamSurfaceHeight(x, leaf.z + 0.04, state) - getStreamSurfaceHeight(x, leaf.z - 0.04, state)) / 0.08,
        leaf.angle + Math.sin(state.time * 0.4 + i) * 0.06,
        -(getStreamSurfaceHeight(x + 0.04, leaf.z, state) - getStreamSurfaceHeight(x - 0.04, leaf.z, state)) / 0.08);
    });
  });
  return <group ref={group}>{leaves.map((leaf, i) => <mesh key={i} geometry={geometry} scale={leaf.scale}>
    <meshStandardMaterial color={leaf.color} roughness={0.8} metalness={0} side={THREE.DoubleSide} />
  </mesh>)}</group>;
};

// Fragmented, low-opacity wakes only behind emergent rocks, never a white bank outline.
const RockWakes: React.FC<{ rocks: StreamRock[]; dynamics: DynamicsRef }> = ({ rocks, dynamics }) => {
  const geometry = useMemo(() => {
    const positions: number[] = [], uv: number[] = [], depths: number[] = [], indices: number[] = [];
    rocks.forEach(rock => {
      if (rock.y + rock.scale[1] < STREAM_WATER_LEVEL + 0.025 || rock.y - rock.scale[1] > STREAM_WATER_LEVEL) return;
      const width = rock.scale[0] * 1.1, length = 0.35 + rock.scale[2] * 0.8;
      const startZ = rock.z + rock.scale[2] * 0.65;
      const offset = positions.length / 3;
      for (const [u, v] of [[-1, 0], [1, 0], [-1, 1], [1, 1]]) {
        const z = startZ + v * length;
        const x = rock.x + (getStreamCenterX(z) - getStreamCenterX(startZ)) + u * width / 2;
        positions.push(x, STREAM_WATER_LEVEL + 0.003, z); uv.push(u, v);
        depths.push(STREAM_WATER_LEVEL - getTerrainHeight(x, z));
      }
      indices.push(offset, offset + 2, offset + 1, offset + 1, offset + 2, offset + 3);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('streamDepth', new THREE.Float32BufferAttribute(depths, 1));
    geo.setIndex(indices); geo.computeVertexNormals(); return geo;
  }, [rocks]);
  const surface = useMemo(() => {
    const uniforms = { level: { value: 0 }, height: { value: 0 }, travel: { value: 0 }, foam: { value: 0 } };
    const material = new THREE.MeshBasicMaterial({ color: '#a8b5a9', transparent: true, depthWrite: false, opacity: 0 });
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, { wakeLevel: uniforms.level, wakeHeight: uniforms.height, wakeTravel: uniforms.travel, wakeFoam: uniforms.foam });
      shader.vertexShader = 'uniform float wakeLevel;\nuniform float wakeHeight;\nuniform float wakeTravel;\nattribute float streamDepth;\nvarying vec2 wakeUv;\nvarying float wakeDepth;\n' + STREAM_WAVE_GLSL + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        wakeDepth=streamDepth+wakeLevel; wakeUv=uv;
        transformed.y+=wakeLevel+streamWave(position.xz,wakeDepth,wakeTravel,wakeHeight);`);
      shader.fragmentShader = 'uniform float wakeTravel;\nuniform float wakeFoam;\nvarying vec2 wakeUv;\nvarying float wakeDepth;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        float flecks=0.5+0.5*sin(wakeUv.x*33.0+sin(wakeUv.y*28.0-wakeTravel*18.0));
        float fade=(1.0-smoothstep(0.15,1.0,wakeUv.y))*(1.0-smoothstep(0.2,1.0,abs(wakeUv.x)));
        diffuseColor.a=wakeFoam*0.48*fade*smoothstep(0.65,0.95,flecks)*smoothstep(0.005,0.07,wakeDepth);`);
    };
    material.customProgramCacheKey = () => 'stream-local-rock-wakes-v1';
    return { material, uniforms };
  }, []);
  useFrame(() => {
    const state = dynamics.current;
    surface.uniforms.level.value = state.levelRise; surface.uniforms.height.value = state.waveHeight;
    surface.uniforms.travel.value = state.distance; surface.uniforms.foam.value = state.foam;
    surface.material.opacity = state.foam;
  });
  useEffect(() => () => { geometry.dispose(); surface.material.dispose(); }, [geometry, surface]);
  return <mesh geometry={geometry} material={surface.material} />;
};

export const Stream: React.FC = () => {
  const waterMeshRef = useRef<THREE.Mesh>(null), boatRef = useRef<THREE.Group>(null);
  const rainType = useAppStore(state => state.rainType);
  const intensity = useAppStore(state => state.config.rainIntensity);
  const timeOfDay = useAppStore(state => state.timeOfDay);
  const brightness = useAppStore(state => state.config.lightBrightness);
  const waterImpactStrength = useAppStore(state => state.config.waterImpactStrength);
  const waterImpactDensity = useAppStore(state => state.config.waterImpactDensity);
  const target = useMemo(() => ({ ...getStreamConditions(rainType, intensity), waterImpactStrength, waterImpactDensity }),
    [rainType, intensity, waterImpactStrength, waterImpactDensity]);
  const dynamics = useRef(createStreamDynamics(rainType, intensity, { waterImpactStrength, waterImpactDensity }));
  const waterNormalTex = useMemo(createWaterNormalTexture, []);
  const reflection = useCubeCamera({ resolution: 128, near: 0.1, far: 65 });
  const captured = useRef(false);
  const floating = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    reflection.camera.position.set(getStreamCenterX(0), 1.2, 0);
    captured.current = false;
  }, [reflection.camera, timeOfDay, rainType, brightness]);
  useEffect(() => {
    waterNormalTex.repeat.set(2.5, 24); waterNormalTex.offset.set(0, 0); waterNormalTex.anisotropy = 4;
    return () => waterNormalTex.dispose();
  }, [waterNormalTex]);

  const { waterGeo, rocks } = useMemo(() => {
    const geo = new THREE.PlaneGeometry(STREAM_SURFACE_HALF_WIDTH * 2, TERRAIN_SIZE, 80, 1020);
    geo.rotateX(-Math.PI / 2);
    const positions = geo.attributes.position, depths = new Float32Array(positions.count);
    const offsets = new Float32Array(positions.count);
    for (let i = 0; i < positions.count; i++) {
      const z = positions.getZ(i), across = positions.getX(i), x = getStreamCenterX(z) + across;
      positions.setXYZ(i, x, STREAM_WATER_LEVEL, z);
      // Signed depth is essential: raising the water must not flood every dry vertex.
      depths[i] = STREAM_WATER_LEVEL - getTerrainHeight(x, z); offsets[i] = across;
    }
    geo.setAttribute('streamDepth', new THREE.BufferAttribute(depths, 1));
    geo.setAttribute('channelOffset', new THREE.BufferAttribute(offsets, 1)); geo.computeVertexNormals();
    geo.computeBoundingBox(); geo.computeBoundingSphere();
    geo.boundingBox!.max.y += 0.08; geo.boundingSphere!.radius += 0.08;
    const rockList: StreamRock[] = [];
    let seed = 1823;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 42; i++) {
      const z = (random() - 0.5) * 32, x = getStreamCenterX(z) + (random() - 0.5) * 2.5;
      const scale = 0.25 + random() * 0.5;
      rockList.push({ x, z, y: getTerrainHeight(x, z) + 0.04,
        scale: [scale, scale * (0.5 + random() * 0.4), scale * (0.8 + random() * 0.4)],
        rot: [random() * 0.5, random() * Math.PI, random() * 0.5] });
    }
    return { waterGeo: geo, rocks: rockList };
  }, []);

  const waterSurface = useMemo(() => {
    const uniforms = {
      time: { value: 0 }, travel: { value: 0 }, rain: { value: 0 }, coverage: { value: 0 },
      height: { value: 0 }, level: { value: 0 }, turbidity: { value: 0 }, reflectionLight: { value: 1 },
      shallow: { value: new THREE.Color('#83958b') }, deep: { value: new THREE.Color('#49655d') },
      muddyShallow: { value: new THREE.Color('#847b65') }, muddyDeep: { value: new THREE.Color('#5d6250') },
    };
    const material = new THREE.MeshPhysicalMaterial({ normalMap: waterNormalTex, normalScale: new THREE.Vector2(0.3, 0.3),
      roughness: 0.28, metalness: 0, ior: 1.333, specularIntensity: 0.55,
      envMap: reflection.fbo.texture, envMapIntensity: 0.30, clearcoat: 0.10, clearcoatRoughness: 0.34,
      transparent: true, opacity: 0.5, depthWrite: false });
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, { streamTime: uniforms.time, streamTravel: uniforms.travel,
        rainImpact: uniforms.rain, rainCoverage: uniforms.coverage, waveHeight: uniforms.height,
        levelRise: uniforms.level, turbidity: uniforms.turbidity, reflectionLight: uniforms.reflectionLight, riverShallow: uniforms.shallow,
        riverDeep: uniforms.deep, muddyShallow: uniforms.muddyShallow, muddyDeep: uniforms.muddyDeep });
      shader.vertexShader = 'uniform float streamTime;\nuniform float rainImpact;\nuniform float rainCoverage;\nuniform float streamTravel;\nuniform float waveHeight;\nuniform float levelRise;\nattribute float streamDepth;\nattribute float channelOffset;\nvarying float waterDepth;\nvarying float riverAcross;\nvarying vec3 streamWorld;\n' + STREAM_WAVE_GLSL + STREAM_RAIN_GLSL + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        waterDepth=streamDepth+levelRise; riverAcross=channelOffset;
        transformed.y+=levelRise+streamWave(position.xz,waterDepth,streamTravel,waveHeight);
        transformed.y+=streamRainField(position.xz).z*smoothstep(0.015,0.09,waterDepth);
        streamWorld=(modelMatrix*vec4(transformed,1.0)).xyz;`);
      shader.fragmentShader = 'uniform float reflectionLight;\nuniform float streamTime;\nuniform float streamTravel;\nuniform float rainImpact;\nuniform float rainCoverage;\nuniform float turbidity;\nuniform vec3 riverShallow;\nuniform vec3 riverDeep;\nuniform vec3 muddyShallow;\nuniform vec3 muddyDeep;\nvarying float waterDepth;\nvarying float riverAcross;\nvarying vec3 streamWorld;\n' + STREAM_RAIN_GLSL + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        float depthAmount=smoothstep(0.0,0.34,max(0.0,waterDepth));
        vec3 shallow=mix(riverShallow,muddyShallow,turbidity);
        vec3 deep=mix(riverDeep,muddyDeep,turbidity);
        diffuseColor.rgb=mix(shallow,deep,depthAmount);
        vec3 rainField=streamRainField(streamWorld.xz);
        float across=streamWorld.x-(sin(streamWorld.z*0.2)*2.4-5.0);
        float thread=pow(max(0.0,sin(across*34.0+sin((streamWorld.z-streamTravel)*1.4))),22.0);
        float drift=pow(0.5+0.5*sin((streamWorld.z-streamTravel)*3.2+across*3.0),6.0);
        diffuseColor.rgb+=vec3(0.012,0.014,0.012)*thread*drift*depthAmount;
        float disturbance=smoothstep(0.6,2.5,rainCoverage)*smoothstep(0.1,1.2,rainImpact);
        float alpha=mix(0.16,0.49,depthAmount)+turbidity*0.28+disturbance*0.10;
        float bank=1.0-smoothstep(${(STREAM_CHANNEL_HALF_WIDTH - 0.08).toFixed(2)},${STREAM_CHANNEL_HALF_WIDTH.toFixed(2)},abs(riverAcross));
        diffuseColor.a=alpha*smoothstep(0.0,0.025,waterDepth)*bank;`);
      // Replace the native normal calculation, rather than applying a second perturbation to it.
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `
        float flowShift=streamTravel*24.0/${TERRAIN_SIZE.toFixed(1)};
        vec2 uv1=vNormalMapUv+vec2(0.01*sin(streamTime*0.2),flowShift);
        vec2 uv2=vNormalMapUv*vec2(1.8,1.7)+vec2(0.13,flowShift*1.7);
        vec3 n1=texture2D(normalMap,uv1).xyz*2.0-1.0;
        vec3 n2=texture2D(normalMap,uv2).xyz*2.0-1.0;
        vec2 slope=(n1.xy+n2.xy*0.45)*normalScale*0.38;
        normal=normalize(tbn*normalize(vec3(slope,1.0)));
        vec2 rainSlope=rainField.xy*smoothstep(0.015,0.09,waterDepth);
        normal=normalize(normal+(viewMatrix*vec4(-rainSlope.x,0.0,-rainSlope.y,0.0)).xyz);`);
      // An overcast sky is a broad light source. Its reflection changes across
      // each crest/trough, even when the cached forest cube has little contrast.
      shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
        vec3 waterView=normalize(vViewPosition);
        vec3 reflectedWorld=inverseTransformDirection(reflect(-waterView,normal),viewMatrix);
        float skyVisibility=smoothstep(-0.12,0.55,reflectedWorld.y);
        vec3 overcastReflection=mix(vec3(0.045,0.075,0.060),vec3(0.48,0.55,0.52),skyVisibility);
        float facing=clamp(dot(normal,waterView),0.0,1.0);
        float fresnel=0.035+0.965*pow(1.0-facing,5.0);
        float reflectionWeight=clamp(0.16+fresnel*0.65,0.0,0.65);
        outgoingLight=mix(outgoingLight,overcastReflection*reflectionLight,reflectionWeight);
        #include <opaque_fragment>`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <clearcoat_normal_fragment_maps>', `#include <clearcoat_normal_fragment_maps>
        clearcoatNormal=normal;`);
    };
    material.customProgramCacheKey = () => 'weather-responsive-stream-v10-dense-broken-splashes';
    return { material, uniforms };
  }, [waterNormalTex, reflection.fbo.texture]);
  useEffect(() => () => { waterGeo.dispose(); waterSurface.material.dispose(); }, [waterGeo, waterSurface]);

  // Update the shared state before any floating objects read it.
  useFrame((_, delta) => {
    advanceStream(dynamics.current, target, delta);
    const state = dynamics.current, u = waterSurface.uniforms;
    u.time.value = state.time; u.travel.value = state.distance; u.rain.value = state.waterImpactStrength;
    u.coverage.value = state.waterImpactDensity; u.height.value = state.waveHeight;
    u.level.value = state.levelRise; u.turbidity.value = state.turbidity;
    const skyLight = timeOfDay === 'night' ? 0.10 : timeOfDay === 'dusk' ? 0.45 : timeOfDay === 'dawn' ? 0.65 : 1;
    u.reflectionLight.value = skyLight * THREE.MathUtils.clamp(brightness / 1.2, 0.25, 1.5);
    waterSurface.material.roughness = 0.20 + state.rainImpact * 0.08;
    waterSurface.material.envMapIntensity = 0.42 - Math.min(1, state.rainImpact) * 0.06;
  }, -1);
  useFrame((_, delta) => {
    const state = dynamics.current;
    if (!captured.current && waterMeshRef.current) {
      waterMeshRef.current.visible = false;
      if (boatRef.current) boatRef.current.visible = false;
      if (floating.current) floating.current.visible = false;
      try { reflection.update(); captured.current = true; }
      finally {
        waterMeshRef.current.visible = true;
        if (boatRef.current) boatRef.current.visible = true;
        if (floating.current) floating.current.visible = true;
      }
    }
    if (boatRef.current) {
      let z = boatRef.current.position.z + Math.min(delta, 0.1) * state.flowSpeed;
      if (z > TERRAIN_SIZE / 2 - 1) z = -TERRAIN_SIZE / 2 + 1;
      const x = getStreamCenterX(z);
      boatRef.current.position.set(x, getStreamSurfaceHeight(x, z, state) + 0.045, z);
      const dz = getStreamSurfaceHeight(x, z + 0.05, state) - getStreamSurfaceHeight(x, z - 0.05, state);
      const dx = getStreamSurfaceHeight(x + 0.05, z, state) - getStreamSurfaceHeight(x - 0.05, z, state);
      boatRef.current.rotation.set(dz / 0.1, Math.atan2(Math.cos(z * 0.2) * 0.48, 1), -dx / 0.1);
    }
  });
  const handleWaterClick = (event: { stopPropagation: () => void }) => { event.stopPropagation(); soundEngine.playWaterDrip(); };
  return <group>
    <mesh ref={waterMeshRef} renderOrder={1} geometry={waterGeo} material={waterSurface.material}
      onClick={handleWaterClick} onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = 'default'; }} receiveShadow />
    <group ref={floating}>
      <DriftingLeaves dynamics={dynamics} />
      <RockWakes rocks={rocks} dynamics={dynamics} />
      <StreamRainImpacts rocks={rocks} dynamics={dynamics} envMap={reflection.fbo.texture} />
    </group>
    <StreamRocks rocks={rocks} dynamics={dynamics} />
    <StreamLife rocks={rocks} />
    <group ref={boatRef} position={[-3.2, STREAM_WATER_LEVEL + 0.045, -10]}>
      <mesh castShadow><coneGeometry args={[0.08, 0.45, 4]} /><meshStandardMaterial color="#638048" roughness={0.4} /></mesh>
      <mesh position={[0, 0.06, 0]}><sphereGeometry args={[0.025, 8, 8]} />
        <meshStandardMaterial color="#ffe8aa" emissive="#ffc459" emissiveIntensity={1.5} /></mesh>
      <pointLight color="#ffa834" intensity={0.4} distance={2.5} />
    </group>
  </group>;
};
