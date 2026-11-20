import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { getTerrainHeight, GROUND_PUDDLES, TERRAIN_SIZE } from './terrain';

// Refine only the handful of cells around small basins. The rest of the forest
// retains its original grid; this avoids adding subdivisions across 85 metres.
export function createForestGroundGeometry(segments = 192): THREE.BufferGeometry {
  const base = new THREE.PlaneGeometry(TERRAIN_SIZE,TERRAIN_SIZE,segments,segments);
  base.rotateX(-Math.PI/2);
  const point = base.attributes.position, step = TERRAIN_SIZE/segments, half = TERRAIN_SIZE/2;
  for(let i=0;i<point.count;i++) point.setY(i,getTerrainHeight(point.getX(i),point.getZ(i)));
  const positions = Array.from(point.array), uvs = Array.from(base.attributes.uv.array), indices: number[] = [];
  const refined = new Set<number>();
  for(const p of GROUND_PUDDLES) {
    const minX=Math.max(0,Math.floor((p.x-p.radiusX*1.8+half)/step));
    const maxX=Math.min(segments-1,Math.floor((p.x+p.radiusX*1.8+half)/step));
    const minZ=Math.max(0,Math.floor((p.z-p.radiusZ*1.8+half)/step));
    const maxZ=Math.min(segments-1,Math.floor((p.z+p.radiusZ*1.8+half)/step));
    for(let z=minZ;z<=maxZ;z++) for(let x=minX;x<=maxX;x++) refined.add(z*segments+x);
  }
  const divisions=4;
  for(let z=0;z<segments;z++) for(let x=0;x<segments;x++) {
    const a=z*(segments+1)+x,b=a+segments+1,c=b+1,d=a+1;
    if(!refined.has(z*segments+x)) {indices.push(a,b,d,b,c,d);continue;}
    const offset=positions.length/3;
    for(let iz=0;iz<=divisions;iz++) for(let ix=0;ix<=divisions;ix++) {
      const u=ix/divisions,v=iz/divisions;
      const px=-half+(x+u)*step,pz=-half+(z+v)*step;
      let y=getTerrainHeight(px,pz);
      // Match unsplit neighbours exactly at the boundary to avoid cracks.
      if(ix===0&&!refined.has(z*segments+x-1)) y=THREE.MathUtils.lerp(point.getY(a),point.getY(b),v);
      if(ix===divisions&&!refined.has(z*segments+x+1)) y=THREE.MathUtils.lerp(point.getY(d),point.getY(c),v);
      if(iz===0&&!refined.has((z-1)*segments+x)) y=THREE.MathUtils.lerp(point.getY(a),point.getY(d),u);
      if(iz===divisions&&!refined.has((z+1)*segments+x)) y=THREE.MathUtils.lerp(point.getY(b),point.getY(c),u);
      positions.push(px,y,pz);uvs.push((px+half)/TERRAIN_SIZE,1-(pz+half)/TERRAIN_SIZE);
    }
    for(let iz=0;iz<divisions;iz++) for(let ix=0;ix<divisions;ix++) {
      const i=offset+iz*(divisions+1)+ix,j=i+divisions+1;
      indices.push(i,j,i+1,j,j+1,i+1);
    }
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(indices);
  base.dispose();
  const welded=mergeVertices(geo,0.00001);geo.dispose();welded.computeVertexNormals();
  return welded;
}
