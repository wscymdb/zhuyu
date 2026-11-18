import React, { useRef, useMemo, useLayoutEffect, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useCubeCamera } from '@react-three/drei';
import { useAppStore } from '../../stores/useAppStore';
import { soundEngine } from '../../utils/audioSynthesizer';
import { createWaterNormalTexture } from '../../utils/natureTextureGenerator';
import { getTerrainHeight, getStreamCenterX, TERRAIN_SIZE, STREAM_SURFACE_HALF_WIDTH, STREAM_WATER_LEVEL } from '../../utils/terrain';
import { StreamRocks, type StreamRock } from './StreamRocks';
import { StreamLife } from './StreamLife';

export const Stream: React.FC = () => {
  const waterMeshRef = useRef<THREE.Mesh>(null);
  const boatRef = useRef<THREE.Group>(null);
  const waterNormalTex = useMemo(() => createWaterNormalTexture(), []);

  const weather = useAppStore(state=>state.weather);
  const brightness = useAppStore(state=>state.config.lightBrightness);
  const reflection = useCubeCamera({resolution:128,near:0.1,far:65});
  const captured = useRef(false);
  useLayoutEffect(()=>{
    reflection.camera.position.set(getStreamCenterX(0),1.2,0);
    captured.current=false;
  },[reflection.camera,weather,brightness]);
  useEffect(()=>{
    waterNormalTex.repeat.set(2.5,28);
    waterNormalTex.anisotropy=8;
    return ()=>waterNormalTex.dispose();
  },[waterNormalTex]);

  // Extend under both banks and to the terrain boundary. The bank mesh and
  // depth-based shoreline mask define the visible edge, not a narrow rectangle.
  const { waterGeo, rocks } = useMemo(() => {
    // 水面平面，细分网格用于波浪微动
    const geo = new THREE.PlaneGeometry(STREAM_SURFACE_HALF_WIDTH*2, TERRAIN_SIZE, 24, 256);
    geo.rotateX(-Math.PI / 2);

    // 将矩形水面弯曲成蜿蜒的自然溪流 (与地形河谷 100% 对齐)
    const pos = geo.attributes.position;
    const depths = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i);
      const originalX = pos.getX(i);
      // 水流蜿蜒中心线：位于亭子左前方山谷中 (x ≈ -5.0)
      const centerX = getStreamCenterX(z);
      pos.setX(i, centerX + originalX);
      pos.setY(i, STREAM_WATER_LEVEL);
      depths[i] = Math.max(0,STREAM_WATER_LEVEL-getTerrainHeight(centerX+originalX,z));
    }
    geo.setAttribute('streamDepth',new THREE.BufferAttribute(depths,1));
    geo.computeVertexNormals();

    // 溪畔与溪中散落的青苔乱石 (精确吸附在河床斜坡与浅滩中)
    const rockList: StreamRock[] = [];
    let seed=1823;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    for (let i = 0; i < 42; i++) {
      const z = (random() - 0.5) * 32;
      const centerX = getStreamCenterX(z);
      // 散在溪边泥坡或溪水中央
      const offset = (random() - 0.5) * 2.5;
      const x = centerX + offset;
      const scaleBase = 0.25 + random() * 0.5;
      const y = getTerrainHeight(x, z) + 0.04;

      rockList.push({
        x,
        y,
        z,
        scale: [scaleBase, scaleBase * (0.5 + random() * 0.4), scaleBase * (0.8 + random() * 0.4)],
        rot: [random() * 0.5, random() * Math.PI, random() * 0.5],
      });
    }

    return { waterGeo: geo, rocks: rockList };
  }, []);

  const waterSurface=useMemo(()=>{
    const time={value:0};
    const material=new THREE.MeshPhysicalMaterial({
      normalMap:waterNormalTex,normalScale:new THREE.Vector2(0.3,0.3),
      color:'#ffffff',roughness:0.24,metalness:0,ior:1.33,specularIntensity:0.6,
      envMap:reflection.fbo.texture,envMapIntensity:0.42,
      clearcoat:0.12,clearcoatRoughness:0.3,transparent:true,opacity:0.58,depthWrite:false,
    });
    material.onBeforeCompile=shader=>{
      shader.uniforms.streamTime=time;
      shader.uniforms.riverShallow={value:new THREE.Color('#839186')};
      shader.uniforms.riverDeep={value:new THREE.Color('#48615a')};
      shader.vertexShader='uniform float streamTime;\nattribute float streamDepth;\nvarying float waterDepth;\nvarying vec3 streamWorld;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        transformed.y+=sin(position.z*2.1-streamTime*1.6)*0.004
          +sin(position.x*5.0+position.z*3.2-streamTime*1.1)*0.002;
        waterDepth=streamDepth;
        streamWorld=(modelMatrix*vec4(transformed,1.0)).xyz;`);
      shader.fragmentShader='uniform float streamTime;\nuniform vec3 riverShallow;\nuniform vec3 riverDeep;\nvarying float waterDepth;\nvarying vec3 streamWorld;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        float depthAmount=smoothstep(0.0,0.32,waterDepth);
        diffuseColor.rgb=mix(riverShallow,riverDeep,depthAmount);
        float channelX=streamWorld.x-(sin(streamWorld.z*0.2)*2.4-5.0);
        float fineFlow=pow(max(0.0,sin(channelX*37.0+sin(streamWorld.z*1.4-streamTime)*1.3)),22.0);
        float travel=pow(0.5+0.5*sin(streamWorld.z*3.0-streamTime*2.1+channelX*4.0),6.0);
        diffuseColor.rgb+=vec3(0.025,0.028,0.025)*fineFlow*travel*depthAmount;
        diffuseColor.a=mix(0.16,0.5,depthAmount)*smoothstep(0.0,0.025,waterDepth);`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
        vec2 rainCell=floor(streamWorld.xz*2.4);
        float rainSeed=fract(sin(dot(rainCell,vec2(127.1,311.7)))*43758.5453);
        vec2 drop=fract(streamWorld.xz*2.4)-vec2(0.25+rainSeed*0.5,0.65-rainSeed*0.3);
        float radius=length(drop);
        float age=fract(streamTime*0.8+rainSeed);
        float front=radius-age*0.55;
        float ring=sin(front*90.0)*exp(-front*front*210.0)*(1.0-age)*0.025;
        vec2 ripple=drop/max(radius,0.01)*ring;
        normal=normalize(normal+(viewMatrix*vec4(ripple.x,0.0,ripple.y,0.0)).xyz);`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <clearcoat_normal_fragment_maps>',`#include <clearcoat_normal_fragment_maps>
        clearcoatNormal=normal;`);
    };
    material.customProgramCacheKey=()=> 'rainy-shallow-stream-v2';
    return {material,time};
  },[waterNormalTex,reflection.fbo.texture]);
  useEffect(()=>()=>{waterGeo.dispose();waterSurface.material.dispose();},[waterGeo,waterSurface]);

  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();
    waterSurface.time.value=time;
    waterNormalTex.offset.y+=delta*0.025;
    waterNormalTex.offset.x=Math.sin(time*0.23)*0.012;
    if(!captured.current && waterMeshRef.current) {
      waterMeshRef.current.visible=false;
      if(boatRef.current) boatRef.current.visible=false;
      try {reflection.update();captured.current=true;}
      finally {
        waterMeshRef.current.visible=true;
        if(boatRef.current) boatRef.current.visible=true;
      }
    }

    // 顺流而下的小舟 (在河谷溪水中平稳漂流)
    if (boatRef.current) {
      let curZ = boatRef.current.position.z + delta * 0.9;
      if (curZ > TERRAIN_SIZE/2-1) curZ = -TERRAIN_SIZE/2+1;

      const curX = getStreamCenterX(curZ);
      const bob = Math.sin(time * 4) * 0.015;

      boatRef.current.position.set(curX, STREAM_WATER_LEVEL+0.05+bob, curZ);
      boatRef.current.rotation.set(Math.sin(time * 3) * 0.05, 0.1, Math.cos(time * 3) * 0.05);
    }
  });

  const handleWaterClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    soundEngine.playWaterDrip();
  };

  return (
    <group>
      {/* 1. 流动清溪水面 (带水流动态法线波光与清澈高光折射) */}
      <mesh
        ref={waterMeshRef}
        geometry={waterGeo}
        material={waterSurface.material}
        onClick={handleWaterClick}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = 'default')}
        receiveShadow
      />

      {/* 2. 溪中与溪畔青苔石头 */}
      <StreamRocks rocks={rocks} />
      <StreamLife rocks={rocks} />

      {/* 3. 顺流飘拂的竹叶心愿舟 (带暖色微光) */}
      <group ref={boatRef} position={[-3.2, 0.12, -10]}>
        {/* 叶片/小舟 */}
        <mesh castShadow>
          <coneGeometry args={[0.08, 0.45, 4]} />
          <meshStandardMaterial color="#638048" roughness={0.4} />
        </mesh>
        {/* 舟上小微光烛灯 */}
        <mesh position={[0, 0.06, 0]}>
          <sphereGeometry args={[0.025, 8, 8]} />
          <meshStandardMaterial color="#ffe8aa" emissive="#ffc459" emissiveIntensity={1.5} />
        </mesh>
        <pointLight color="#ffa834" intensity={0.4} distance={2.5} />
      </group>
    </group>
  );
};
