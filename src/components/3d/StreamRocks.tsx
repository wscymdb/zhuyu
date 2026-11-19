import React, { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { STREAM_WATER_LEVEL } from '../../utils/terrain';
import type { StreamDynamics } from '../../utils/streamDynamics';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface StreamRock {
  x: number; y: number; z: number;
  scale: [number, number, number]; rot: [number, number, number];
}

function createRock(variant: number) {
  let geo = new THREE.IcosahedronGeometry(1, 4);
  const positions = geo.attributes.position;
  const phase = variant * 1.73;
  for(let i=0;i<positions.count;i++) {
    const x=positions.getX(i), y=positions.getY(i), z=positions.getZ(i);
    const erosion=1+Math.sin(x*3.2+phase)*Math.cos(z*2.6-phase)*0.11
      +Math.sin(y*4.0+z*2.3+phase)*0.055;
    positions.setXYZ(i,x*erosion+0.11*y*y*Math.sin(phase),
      y*erosion-(y>0.45?Math.pow(y-0.45,1.5)*0.22:0),z*erosion);
  }
  // Weld the faces before calculating normals, so the rounded boulder does
  // not inherit the visible triangular facets of the original polyhedron.
  geo.deleteAttribute('normal'); geo.deleteAttribute('uv');
  const welded=mergeVertices(geo,0.0001); geo.dispose(); geo=welded as THREE.IcosahedronGeometry;
  geo.computeVertexNormals();
  geo.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count*2),2));
  return geo;
}

function stoneMaterial(map: THREE.Texture, waterLevel: { value: number }) {
  const material=new THREE.MeshPhysicalMaterial({map,roughness:0.72,metalness:0,
    clearcoat:0.12,clearcoatRoughness:0.4,specularIntensity:0.6});
  material.onBeforeCompile=shader=>{
    shader.uniforms.rockWaterLevel=waterLevel;
    shader.vertexShader='varying vec3 rockPosition;\nvarying vec3 rockNormal;\nvarying vec3 rockWorld;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      rockPosition=position;
      rockNormal=normal;
      rockWorld=(modelMatrix*vec4(transformed,1.0)).xyz;`);
    shader.fragmentShader='uniform float rockWaterLevel;\nvarying vec3 rockPosition;\nvarying vec3 rockNormal;\nvarying vec3 rockWorld;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_pars_fragment>',`#include <map_pars_fragment>
      vec3 stoneSample(vec3 p,vec3 weights) {
        p=p*1.1+vec3(0.31,0.17,0.43);
        return texture2D(map,p.yz).rgb*weights.x+texture2D(map,p.xz).rgb*weights.y+texture2D(map,p.xy).rgb*weights.z;
      }`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      vec3 rockWeights=pow(abs(normalize(rockNormal)),vec3(4.0));
      rockWeights/=max(dot(rockWeights,vec3(1.0)),0.0001);
      vec3 stone=stoneSample(rockPosition,rockWeights);
      float waterline=1.0-smoothstep(rockWaterLevel,rockWaterLevel+0.24,rockWorld.y);
      diffuseColor.rgb*=stone*mix(0.98,0.62,waterline);`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      float height=dot(stone,vec3(0.299,0.587,0.114));
      float dhx=dot(stoneSample(rockPosition+dFdx(rockPosition),rockWeights),vec3(0.299,0.587,0.114))-height;
      float dhy=dot(stoneSample(rockPosition+dFdy(rockPosition),rockWeights),vec3(0.299,0.587,0.114))-height;
      vec3 sx=dFdx(-vViewPosition), sy=dFdy(-vViewPosition);
      vec3 r1=cross(sy,normal), r2=cross(normal,sx);
      float determinant=dot(sx,r1)*faceDirection;
      vec3 gradient=sign(determinant)*(dhx*r1+dhy*r2)*0.025;
      normal=normalize(abs(determinant)*normal-gradient);`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
      roughnessFactor=mix(0.76,0.43,waterline);`);
  };
  material.customProgramCacheKey=()=> 'river-stone-triplanar-v2';
  return material;
}

export const StreamRocks: React.FC<{rocks:StreamRock[];dynamics:React.MutableRefObject<StreamDynamics>}>=({rocks,dynamics})=>{
  const textures=useTexture({stone:'/textures/rocks/river-stone-v1.png',moss:'/textures/rocks/moss-stone-v1.png'});
  useEffect(()=>{
    Object.values(textures).forEach(texture=>{
      texture.colorSpace=THREE.SRGBColorSpace;
      texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
      texture.anisotropy=8; texture.needsUpdate=true;
    });
  },[textures]);
  const waterLevel=useMemo(()=>({value:STREAM_WATER_LEVEL}),[]);
  useFrame(()=>{waterLevel.value=STREAM_WATER_LEVEL+dynamics.current.levelRise;});
  const geometries=useMemo(()=>Array.from({length:6},(_,i)=>createRock(i)),[]);
  const materials=useMemo(()=>[stoneMaterial(textures.stone,waterLevel),stoneMaterial(textures.moss,waterLevel)],[textures,waterLevel]);
  useEffect(()=>()=>{geometries.forEach(geo=>geo.dispose());materials.forEach(mat=>mat.dispose());},[geometries,materials]);
  return <group>{rocks.map((rock,i)=><mesh key={i} geometry={geometries[i%6]}
    material={materials[i%3===0?1:0]} position={[rock.x,rock.y,rock.z]} scale={rock.scale}
    rotation={rock.rot} castShadow receiveShadow />)}</group>;
};
