import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useTexture, useCubeCamera } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useAppStore } from '../../stores/useAppStore';
import { PebblePath } from './PebblePath';
import { createBambooLayout } from '../../utils/bambooLayout';
import { getStreamCenterX, getTerrainHeight, PAVILION_POS, TERRAIN_SIZE } from '../../utils/terrain';

function randomSource(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function pathCenter(z: number) {
  return PAVILION_POS[0] + Math.sin((z - 4.4) * 0.19) * 1.2;
}

// Masks use world metres so soil, path and moss do not repeat as a tiled image.
const groundMasks = `
  varying vec3 forestWorld;
  float forestHash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float forestNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f*f*(3.0-2.0*f);
    return mix(mix(forestHash(i), forestHash(i+vec2(1,0)),f.x),
      mix(forestHash(i+vec2(0,1)),forestHash(i+vec2(1,1)),f.x),f.y);
  }
  float forestFbm(vec2 p) {
    return forestNoise(p)*0.58 + forestNoise(p*2.03+7.7)*0.28 + forestNoise(p*4.1+16.3)*0.14;
  }
  void forestMasks(out float path, out float moss, out float wet, out float macro) {
    vec2 p = forestWorld.xz;
    macro = forestFbm(p*0.43);
    float pathX = 2.2 + sin((p.y-4.4)*0.19)*1.2;
    float pathEdge = abs(p.x-pathX) + (forestNoise(p*2.1)-0.5)*0.22;
    path = (1.0-smoothstep(0.55,1.13,pathEdge))*smoothstep(3.9,4.7,p.y);
    float bank = abs(p.x - (sin(p.y*0.2)*2.4-5.0));
    float bankEdge = smoothstep(1.45,2.05,bank)*(1.0-smoothstep(2.5,4.1,bank));
    float plinth = abs(max(abs(p.x-2.2),abs(p.y-0.5))-3.57);
    float stoneEdge = (1.0-smoothstep(0.18,0.95,plinth));
    float patches = smoothstep(0.4,0.69,forestFbm(p*1.35+19.2));
    moss = max(bankEdge*patches, stoneEdge*patches*0.65)*(1.0-path*0.9);
    wet = smoothstep(0.34,0.65,forestFbm(p*0.72-31.0))*(1.0-path*0.25);
  }
`;

function LeafLitter() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const leaves = useMemo(() => {
    const random = randomSource(20261118);
    const roots = createBambooLayout().flat();
    const palette = ['#655445', '#74614e', '#5a5045', '#6b5f50', '#726149', '#716b5c', '#656452', '#7c7662', '#8a7b58', '#8c805e', '#647345', '#547143'];
    const list: { x: number; z: number; length: number; width: number; angle: number; shade: THREE.Color }[] = [];
    function addLeaf(x: number, z: number) {
      const dx = Math.abs(x - PAVILION_POS[0]);
      const dz = Math.abs(z - PAVILION_POS[2]);
      if (dx < 3.64 && dz < 3.64) return;
      if (Math.abs(x - getStreamCenterX(z)) < 1.75 || getTerrainHeight(x,z) < -0.04) return;
      const pathDistance = Math.abs(x - pathCenter(z));
      if (z > 4 && pathDistance < 1 && random() > pathDistance * 0.3) return;
      list.push({ x, z, length: 0.13 + random() * 0.17, width: 0.75 + random() * 0.65, angle: random() * Math.PI * 2,
        shade: new THREE.Color(palette[Math.floor(random()*palette.length)]) });
    }
    for (const root of roots) {
      const count = 12 + Math.floor(random() * 19);
      const driftAngle = random() * Math.PI * 2;
      for (let i = 0; i < count; i++) {
        const angle = random() * Math.PI * 2;
        const distance = Math.pow(random(),0.8)*1.8;
        addLeaf(root.x + Math.cos(angle)*distance + Math.cos(driftAngle)*0.4,
          root.z + Math.sin(angle)*distance + Math.sin(driftAngle)*0.4);
      }
    }
    for (let i = 0; i < 1800; i++) addLeaf((random()-0.5)*48,(random()-0.5)*48);
    return list;
  }, []);
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([
      0,0,-0.5, -0.052,0.01,-0.18, 0,0.022,-0.12, 0.052,0.01,-0.18,
      -0.04,0.006,0.22, 0,0.018,0.2, 0.04,0.006,0.22, 0,0.012,0.5,
    ],3));
    geo.setIndex([0,1,2,0,2,3,1,4,2,2,4,5,2,5,3,3,5,6,4,7,5,5,7,6]);
    const colors: number[] = [];
    [0.83,0.72,1,0.85,0.76,0.98,0.88,0.8].forEach(shade=>colors.push(shade,shade,shade));
    geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    geo.computeVertexNormals();
    return geo;
  }, []);
  useLayoutEffect(() => {
    if (!mesh.current) return;
    const dummy = new THREE.Object3D();
    const up = new THREE.Vector3(0,1,0);
    const rotation = new THREE.Quaternion();
    leaves.forEach((leaf,i) => {
      const h = getTerrainHeight(leaf.x,leaf.z);
      const normal = new THREE.Vector3(
        getTerrainHeight(leaf.x-0.08,leaf.z)-getTerrainHeight(leaf.x+0.08,leaf.z),0.16,
        getTerrainHeight(leaf.x,leaf.z-0.08)-getTerrainHeight(leaf.x,leaf.z+0.08)).normalize();
      dummy.position.set(leaf.x,h+0.014,leaf.z);
      dummy.quaternion.setFromUnitVectors(up,normal);
      rotation.setFromAxisAngle(up,leaf.angle);
      dummy.quaternion.multiply(rotation);
      dummy.scale.set(leaf.length*leaf.width,1,leaf.length);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(i,dummy.matrix);
      mesh.current!.setColorAt(i,leaf.shade);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [leaves]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <instancedMesh ref={mesh} args={[geometry,undefined,leaves.length]} castShadow receiveShadow>
    <meshStandardMaterial vertexColors roughness={0.88} metalness={0} side={THREE.DoubleSide} />
  </instancedMesh>;
}

function WetTraces({ environment }: { environment: THREE.Texture }) {
  const geometries = useMemo(() => {
    const random = randomSource(994);
    // A handful of small irregular wet films beside the path and stream.
    const centers = [[3.8,6.1,0.95,0.48],[1.9,8.7,0.7,0.4],[4.9,12.6,0.9,0.45],
      [-0.2,6.4,0.8,0.43],[-2.7,-3.4,0.8,0.42],[0.3,13.5,0.7,0.4],
      [7.0,7.3,1.1,0.58],[9.6,10.4,1.2,0.62],[5.7,4.9,0.7,0.43]];
    return centers.map(([x,z,rx,rz]) => {
      const positions = [x,getTerrainHeight(x,z)+0.028,z];
      const indices: number[] = [];
      const uvs = [0.5,0.5];
      const radii=Array.from({length:24},()=>0.8+random()*0.2);
      for(let i=0;i<=24;i++) {
        const angle=i%24/24*Math.PI*2;
        const r=radii[i%24];
        uvs.push(0.5+Math.cos(angle)*0.5,0.5+Math.sin(angle)*0.5);
        const px=x+Math.cos(angle)*rx*r;
        const pz=z+Math.sin(angle)*rz*r;
        positions.push(px,getTerrainHeight(px,pz)+0.028,pz);
        if(i>0) indices.push(0,i+1,i);
      }
      const geo=new THREE.BufferGeometry();
      geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
      geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
      geo.setIndex(indices); geo.computeVertexNormals();
      return geo;
    });
  }, []);
  const surface = useMemo(() => {
    const time = { value: 0 };
    const material = new THREE.MeshPhysicalMaterial({
      color:'#48493e', roughness:0.34, metalness:0, envMap:environment, envMapIntensity:0.4,
      clearcoat:0.18, clearcoatRoughness:0.32, ior:1.33, specularIntensity:0.45,
      transparent:true, opacity:0.64, depthWrite:false,
    });
    material.onBeforeCompile=shader=>{
      shader.uniforms.rainTime=time;
      shader.vertexShader='varying vec3 puddleWorld;\nvarying vec2 puddleUv;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        puddleWorld=(modelMatrix*vec4(transformed,1.0)).xyz;
        puddleUv=uv;`);
      shader.fragmentShader='uniform float rainTime;\nvarying vec3 puddleWorld;\nvarying vec2 puddleUv;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        diffuseColor.a*=1.0-smoothstep(0.65,1.0,length((puddleUv-0.5)*2.0));`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
        vec2 cell=floor(puddleWorld.xz*2.2);
        float seed=fract(sin(dot(cell,vec2(127.1,311.7)))*43758.5453);
        vec2 drop=fract(puddleWorld.xz*2.2)-vec2(0.25+seed*0.5,0.65-seed*0.3);
        float distanceToDrop=length(drop);
        float age=fract(rainTime*0.7+seed);
        float front=distanceToDrop-age*0.55;
        float ring=sin(front*95.0)*exp(-front*front*220.0)*(1.0-age)*0.035;
        vec2 ripple=drop/max(distanceToDrop,0.01)*ring;
        ripple+=vec2(sin(puddleWorld.x*13.0+rainTime),cos(puddleWorld.z*11.0-rainTime))*0.003;
        normal=normalize(normal+(viewMatrix*vec4(ripple.x,0.0,ripple.y,0.0)).xyz);`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <clearcoat_normal_fragment_maps>',`#include <clearcoat_normal_fragment_maps>
        clearcoatNormal=normal;`);
    };
    material.customProgramCacheKey=()=> 'rain-puddle-v3';
    return {material,time};
  },[environment]);
  useFrame(state=>{surface.time.value=state.clock.elapsedTime;});
  useEffect(() => () => geometries.forEach(geo=>geo.dispose()),[geometries]);
  useEffect(() => () => surface.material.dispose(),[surface]);
  return <group>{geometries.map((geo,i)=><mesh key={i} geometry={geo} material={surface.material} receiveShadow />)}</group>;
}

export const ForestGround: React.FC = () => {
  const root = useRef<THREE.Group>(null);
  const weather = useAppStore(state=>state.weather);
  const brightness = useAppStore(state=>state.config.lightBrightness);
  const reflection = useCubeCamera({resolution:128,near:0.1,far:65});
  const captured = useRef(false);
  useLayoutEffect(()=>{
    reflection.camera.position.set(2.2,1.6,5.1);
    captured.current=false;
  },[reflection.camera,weather,brightness]);
  // Capture the actual sky, pavilion and bamboo once per lighting change.
  // Reuse the probe for every wet patch, rather than rendering each puddle again.
  useFrame(()=>{
    if(captured.current || !root.current) return;
    root.current.visible=false;
    try { reflection.update(); captured.current=true; }
    finally { root.current.visible=true; }
  });
  const pbr = useTexture({
    map:'/textures/ground/damp-soil-v1.png',
  });
  useEffect(() => {
    Object.values(pbr).forEach(texture=>{
      texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
      texture.repeat.set(22,22); texture.anisotropy=8; texture.needsUpdate=true;
    });
    pbr.map.colorSpace=THREE.SRGBColorSpace;
  },[pbr]);
  const geometry=useMemo(()=>{
    const geo=new THREE.PlaneGeometry(TERRAIN_SIZE,TERRAIN_SIZE,192,192);
    geo.rotateX(-Math.PI/2);
    const positions=geo.attributes.position;
    for(let i=0;i<positions.count;i++) positions.setY(i,getTerrainHeight(positions.getX(i),positions.getZ(i)));
    geo.computeVertexNormals();
    return geo;
  },[]);
  const material=useMemo(()=>{
    const mat=new THREE.MeshPhysicalMaterial({map:pbr.map,bumpMap:pbr.map,bumpScale:0.025,
      roughness:0.55,metalness:0,envMap:reflection.fbo.texture,envMapIntensity:0.32,
      clearcoat:0.5,clearcoatRoughness:0.22});
    mat.onBeforeCompile=shader=>{
      shader.uniforms.forestSoil={value:new THREE.Color('#65594b')};
      shader.uniforms.forestPath={value:new THREE.Color('#8a7d66')};
      shader.uniforms.forestMoss={value:new THREE.Color('#485238')};
      shader.vertexShader='varying vec3 forestWorld;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        forestWorld=(modelMatrix*vec4(transformed,1.0)).xyz;`);
      shader.fragmentShader='uniform vec3 forestSoil;\nuniform vec3 forestPath;\nuniform vec3 forestMoss;\n'+groundMasks+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
        float pathMask,mossMask,wetMask,macro;
        forestMasks(pathMask,mossMask,wetMask,macro);
        // Preserve the new soil scan's grains and fibres instead of reducing
        // it to a nearly flat average colour. World masks only add broad zones.
        vec3 earth=mix(diffuseColor.rgb,forestSoil,0.22)*(0.86+macro*0.28);
        vec3 worn=mix(earth,forestPath,0.28);
        earth=mix(earth,worn,pathMask);
        earth=mix(earth,forestMoss*(0.8+forestNoise(forestWorld.xz*13.0)*0.4),mossMask*0.62);
        diffuseColor.rgb=earth*mix(0.92,0.63,wetMask);`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
        float rp,rm,rw,rn;
        forestMasks(rp,rm,rw,rn);
        roughnessFactor=mix(mix(0.63,0.55,rp),0.28,rw);
        roughnessFactor=mix(roughnessFactor,0.88,rm*0.7);`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <lights_physical_fragment>',`#include <lights_physical_fragment>
        float cp,cm,cw,cn;
        forestMasks(cp,cm,cw,cn);
        material.clearcoat=mix(0.08,0.55,cw)*(1.0-cm*0.8);
        material.clearcoatRoughness=mix(0.38,0.2,cw);`);
    };
    mat.customProgramCacheKey=()=> 'forest-wet-soil-v3';
    return mat;
  },[pbr,reflection.fbo.texture]);
  useEffect(()=>()=>{geometry.dispose();material.dispose();},[geometry,material]);
  return <group ref={root}>
    <mesh geometry={geometry} material={material} receiveShadow />
    <PebblePath />
    <LeafLitter />
    <WetTraces environment={reflection.fbo.texture} />
  </group>;
};
