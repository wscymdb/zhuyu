import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useFrame } from '@react-three/fiber';
import { getStreamCenterX, getStreamHalfWidth, getTerrainHeight, STREAM_WATER_LEVEL } from '../../utils/terrain';
import type { StreamRock } from './StreamRocks';

function colored(geo: THREE.BufferGeometry,color: string) {
  const rgb=new THREE.Color(color), values=new Float32Array(geo.attributes.position.count*3);
  for(let i=0;i<geo.attributes.position.count;i++) rgb.toArray(values,i*3);
  geo.setAttribute('color',new THREE.BufferAttribute(values,3));
  if(!geo.attributes.uv) geo.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count*2),2));
  return geo;
}
function triangles(points: number[],indices:number[],color:string) {
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
  geo.setIndex(indices);geo.computeVertexNormals();
  return colored(geo,color);
}
function fishGeometry() {
  const body=new THREE.SphereGeometry(1,16,10);
  body.scale(0.024,0.031,0.105);
  const positions=body.attributes.position;
  const shades=new Float32Array(positions.count*3);
  const back=new THREE.Color('#637466'),belly=new THREE.Color('#c5c8b0');
  for(let i=0;i<positions.count;i++) {
    const y=positions.getY(i),z=positions.getZ(i);
    positions.setX(i,positions.getX(i)*(0.8+z*1.5));
    belly.clone().lerp(back,THREE.MathUtils.smoothstep(y,-0.018,0.022)).toArray(shades,i*3);
  }
  body.setAttribute('color',new THREE.BufferAttribute(shades,3));body.computeVertexNormals();
  const fins=triangles([0,0.023,-0.04,0,0.061,-0.045,0,0.024,0.04,
    -0.014,0,0.035,-0.053,-0.012,-0.01,-0.013,-0.012,-0.025,
    0.014,0,0.035,0.053,-0.012,-0.01,0.013,-0.012,-0.025],
    [0,1,2,3,4,5,6,8,7],'#86927b');
  const parts:THREE.BufferGeometry[]=[body,fins];
  for(const side of [-1,1]) {
    const eye=new THREE.SphereGeometry(0.0038,6,4);eye.translate(side*0.014,0.01,0.078);
    parts.push(colored(eye,'#202b24'));
  }
  const geometry=mergeGeometries(parts)!;parts.forEach(part=>part.dispose());
  const tail=triangles([0,0,0,0,0.035,-0.065,0,0,-0.043,0,-0.035,-0.065], [0,1,2,0,2,3],'#83917b');
  return {geometry,tail};
}

function FishSchools({rocks}:{rocks:StreamRock[]}) {
  const bodies=useRef<THREE.InstancedMesh>(null),tails=useRef<THREE.InstancedMesh>(null);
  const geometry=useMemo(fishGeometry,[]);
  const count=15;
  const dummy=useMemo(()=>new THREE.Object3D(),[]);
  const tailPose=useMemo(()=>new THREE.Object3D(),[]);
  const tailMatrix=useMemo(()=>new THREE.Matrix4(),[]);
  const next=useMemo(()=>new THREE.Vector3(),[]),position=useMemo(()=>new THREE.Vector3(),[]);
  function route(i:number,time:number,result:THREE.Vector3) {
    const school=Math.floor(i/5),member=i%5;
    const phase=school*1.8;
    let z=[-0.8,4.5,10.2][school]+Math.sin(time*0.14+phase)*2.1+(member-2)*0.23;
    let x=getStreamCenterX(z)+Math.sin(time*0.23+phase)*0.48+(member%3-1)*0.17;
    for(const rock of rocks) {
      if(Math.abs(rock.z-z)>1.5) continue;
      const rx=rock.scale[0]*0.9+0.13,rz=rock.scale[2]*0.9+0.13;
      const dx=(x-rock.x)/rx,dz=(z-rock.z)/rz;
      const distance=Math.hypot(dx,dz);
      if(distance<1.15) {
        const push=(1.15-distance)/Math.max(distance,0.01);
        x+=dx*push*rx;z+=dz*push*rz;
      }
    }
    const center=getStreamCenterX(z);
    x=THREE.MathUtils.clamp(x,center-Math.min(1.05,getStreamHalfWidth(z,-1)*0.65),center+Math.min(1.05,getStreamHalfWidth(z,1)*0.65));
    const bed=getTerrainHeight(x,z);
    result.set(x,Math.min(STREAM_WATER_LEVEL-0.05,bed+0.12+Math.sin(time*0.8+i)*0.018),z);
  }
  useFrame(state=>{
    if(!bodies.current||!tails.current)return;
    const time=state.clock.elapsedTime;
    for(let i=0;i<count;i++) {
      route(i,time,position);route(i,time+0.08,next);
      dummy.position.copy(position);
      dummy.rotation.set(0,Math.atan2(next.x-position.x,next.z-position.z),Math.sin(time*1.5+i)*0.06);
      dummy.scale.setScalar(0.76+(i%5)*0.065);dummy.updateMatrix();
      bodies.current.setMatrixAt(i,dummy.matrix);
      tailPose.position.set(0,0,-0.096);
      tailPose.rotation.set(0,Math.sin(time*(7+i%3)+i)*0.42,0);tailPose.updateMatrix();
      tailMatrix.multiplyMatrices(dummy.matrix,tailPose.matrix);
      tails.current.setMatrixAt(i,tailMatrix);
    }
    bodies.current.instanceMatrix.needsUpdate=true;tails.current.instanceMatrix.needsUpdate=true;
  });
  useEffect(()=>()=>{geometry.geometry.dispose();geometry.tail.dispose();},[geometry]);
  return <group>
    <instancedMesh ref={bodies} args={[geometry.geometry,undefined,count]} frustumCulled={false}>
      <meshStandardMaterial vertexColors roughness={0.48} metalness={0.08} side={THREE.DoubleSide} />
    </instancedMesh>
    <instancedMesh ref={tails} args={[geometry.tail,undefined,count]} frustumCulled={false}>
      <meshStandardMaterial vertexColors roughness={0.65} side={THREE.DoubleSide} />
    </instancedMesh>
  </group>;
}

function shrimpGeometry() {
  const parts:THREE.BufferGeometry[]=[];
  for(let i=0;i<6;i++) {
    const segment=new THREE.SphereGeometry(1,8,5);
    const radius=0.009-i*0.0007;
    segment.scale(radius,radius*0.75,0.009);
    segment.translate(0,0.016+Math.sin(i/5*Math.PI)*0.008,0.022-i*0.012);
    parts.push(colored(segment,i%2?'#9f9d7f':'#b7b49a'));
  }
  parts.push(triangles([0,0.014,-0.043,-0.018,0.008,-0.063,0,0.007,-0.058,0.018,0.008,-0.063],
    [0,1,2,0,2,3],'#9ea388'));
  for(const side of [-1,1]) {
    const eye=new THREE.SphereGeometry(0.002,5,3);eye.translate(side*0.006,0.022,0.029);
    parts.push(colored(eye,'#2d342b'));
  }
  const body=mergeGeometries(parts)!;parts.forEach(part=>part.dispose());
  const lines:number[]=[];
  for(const side of [-1,1]) {
    for(let leg=0;leg<5;leg++) {
      const z=0.014-leg*0.009;
      lines.push(side*0.005,0.016,z,side*0.023,0.002,z-0.008);
    }
    let previous=new THREE.Vector3(side*0.004,0.018,0.028);
    for(let step=1;step<=5;step++) {
      const point=new THREE.Vector3(side*step*0.005,0.018+Math.sin(step/5*Math.PI)*0.008,0.028+step*0.012);
      lines.push(...previous.toArray(),...point.toArray());previous=point;
    }
  }
  const appendages=new THREE.BufferGeometry();appendages.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));
  return {body,appendages};
}

function BottomShrimp({rocks}:{rocks:StreamRock[]}) {
  const refs=useRef<(THREE.Group|null)[]>([]);
  const geometry=useMemo(shrimpGeometry,[]);
  const anchors=useMemo(()=>{
    const list:{x:number;z:number;angle:number}[]=[];
    for(const rock of rocks) {
      for(const side of [-1,1]) {
        const x=rock.x+side*(rock.scale[0]+0.13),z=rock.z+0.12;
        if(getTerrainHeight(x,z)>STREAM_WATER_LEVEL-0.09 || Math.abs(x-getStreamCenterX(z))>getStreamHalfWidth(z,x<getStreamCenterX(z)?-1:1)*0.7) continue;
        list.push({x,z,angle:list.length*1.8});
        if(list.length===8)return list;
      }
    }
    return list;
  },[rocks]);
  useLayoutEffect(()=>{refs.current.length=anchors.length;},[anchors]);
  useFrame(state=>{
    const time=state.clock.elapsedTime;
    anchors.forEach((anchor,i)=>{
      const group=refs.current[i];if(!group)return;
      const crawl=Math.sin(time*0.17+i)*0.055;
      const x=anchor.x+Math.sin(anchor.angle)*crawl,z=anchor.z+Math.cos(anchor.angle)*crawl;
      group.position.set(x,getTerrainHeight(x,z)+0.014,z);
      group.rotation.y=anchor.angle+Math.sin(time*0.45+i)*0.16;
    });
  });
  useEffect(()=>()=>{geometry.body.dispose();geometry.appendages.dispose();},[geometry]);
  return <group>{anchors.map((_,i)=><group key={i} ref={element=>{refs.current[i]=element;}} scale={0.95+i%3*0.13}>
    <mesh geometry={geometry.body}><meshStandardMaterial vertexColors roughness={0.65} /></mesh>
    <lineSegments geometry={geometry.appendages}><lineBasicMaterial color="#a2aa87" /></lineSegments>
  </group>)}</group>;
}

export const StreamLife:React.FC<{rocks:StreamRock[]}>=({rocks})=><group>
  <FishSchools rocks={rocks} />
  <BottomShrimp rocks={rocks} />
</group>;
