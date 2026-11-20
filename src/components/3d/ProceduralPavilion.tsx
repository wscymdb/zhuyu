import { useSceneTextures } from '../../utils/useSceneTextures';
import React, { useMemo, useEffect } from 'react';
import * as THREE from 'three';


const HALF_ROOF = 4.15;
const EAVE_Y = 3.6;
const ROOF_RISE = 1.9;

// Four planar hip directions keep the silhouette architectural; only the last
// portion of each eave lifts, rather than undulating around a circular cone.
function roofPoint(face: number, r: number, t: number): THREE.Vector3 {
  const x = t * HALF_ROOF * r;
  const z = HALF_ROOF * r;
  const y = ROOF_RISE * Math.pow(1 - r, 1.45)
    + Math.pow(r, 5) * (0.07 + 0.2 * Math.pow(Math.abs(t), 6));
  return new THREE.Vector3(x, y, z).applyAxisAngle(new THREE.Vector3(0, 1, 0), face * Math.PI / 2);
}

function createRoof(): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const rows = 28;
  const columns = 32;
  for (let face = 0; face < 4; face++) {
    const offset = positions.length / 3;
    for (let row = 0; row <= rows; row++) {
      const r = row / rows;
      for (let col = 0; col <= columns; col++) {
        const t = col / columns * 2 - 1;
        const p = roofPoint(face, r, t);
        positions.push(p.x, p.y, p.z);
        // Constant tile size on the triangular face, with courses running downhill.
        uvs.push((t * r + 1) * 2, r * 3);
      }
    }
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const a = offset + row * (columns + 1) + col;
        const b = a + columns + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('uv1', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function Beam({ from, to, width = 0.14, depth = width, color = '#655044' }: {
  from: [number, number, number]; to: [number, number, number];
  width?: number; depth?: number; color?: string;
}) {
  const { midpoint, quaternion, length } = useMemo(() => {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    const direction = end.clone().sub(start);
    return {
      midpoint: start.add(end).multiplyScalar(0.5),
      quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize()),
      length: direction.length(),
    };
  }, [from, to]);
  return <mesh position={midpoint} quaternion={quaternion} castShadow receiveShadow>
    <boxGeometry args={[width, length, depth]} />
    <meshStandardMaterial color={color} roughness={0.78} />
  </mesh>;
}

export const ProceduralPavilion: React.FC = () => {
  const floor = useSceneTextures({
    map: '/textures/pavilion/floor-color.jpg',
    normalMap: '/textures/pavilion/floor-normal.jpg',
    roughnessMap: '/textures/pavilion/floor-roughness.jpg',
    aoMap: '/textures/pavilion/floor-ao.jpg',
  });
  const tiles = useSceneTextures({
    map: '/textures/pavilion/roof-color.jpg',
    normalMap: '/textures/pavilion/roof-normal.jpg',
    roughnessMap: '/textures/pavilion/roof-roughness.jpg',
  });
  useEffect(() => {
    Object.values(floor).forEach(texture => {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(3, 3);
      texture.anisotropy = 8;
      texture.needsUpdate = true;
    });
    floor.map.colorSpace = THREE.SRGBColorSpace;
    Object.values(tiles).forEach(texture => {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.anisotropy = 8;
      texture.needsUpdate = true;
    });
  }, [floor, tiles]);

  const roof = useMemo(createRoof, []);
  const greyTiles = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 2048;
    const ctx = canvas.getContext('2d')!;
    ctx.filter = 'grayscale(1) brightness(1.4) contrast(0.82)';
    ctx.drawImage(tiles.map.image, 0, 0, 2048, 2048);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 8;
    return texture;
  }, [tiles.map]);
  const trims = useMemo(() => Array.from({ length: 4 }, (_, face) => {
    const edge = Array.from({ length: 65 }, (_, i) => roofPoint(face, 1, i / 32 - 1));
    const hip = Array.from({ length: 41 }, (_, i) => roofPoint(face, i / 40, 1).add(new THREE.Vector3(0, 0.035, 0)));
    return {
      edge: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edge), 64, 0.055, 6, false),
      hip: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hip), 40, 0.065, 8, false),
    };
  }), []);
  // Raised tile rolls follow the slope within each triangular roof face.
  const tileRolls = useMemo(() => Array.from({ length: 4 }, (_, face) =>
    Array.from({ length: 29 }, (_, column) => {
      const lateral = (column - 14) * 0.28;
      const start = Math.max(0.04, Math.abs(lateral) / HALF_ROOF + 0.025);
      const points = Array.from({ length: 25 }, (_, step) => {
        const r = start + (1 - start) * step / 24;
        return roofPoint(face, r, lateral / (HALF_ROOF * r)).add(new THREE.Vector3(0, 0.022, 0));
      });
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, 0.027, 6, false);
    })
  ).flat(), []);
  useEffect(() => () => {
    tileRolls.forEach(geometry => geometry.dispose());
  }, [tileRolls]);
  useEffect(() => () => {
    roof.dispose();
    greyTiles.dispose();
    trims.forEach(trim => { trim.edge.dispose(); trim.hip.dispose(); });
  }, [roof, greyTiles, trims]);

  return <group>
    {/* A generous stone terrace with a thin, finished perimeter. */}
    <mesh position={[0, 0.16, 0]} receiveShadow castShadow>
      <boxGeometry args={[7.1, 0.38, 7.1]} />
      <meshStandardMaterial color="#626b67" roughness={0.92} />
    </mesh>
    <mesh position={[0, 0.37, 0]} receiveShadow>
      <boxGeometry args={[6.8, 0.08, 6.8]} />
      <meshStandardMaterial {...floor} normalScale={new THREE.Vector2(0.45, 0.45)} roughness={0.9} aoMapIntensity={0.55} />
    </mesh>

    {[-2.85, 2.85].flatMap(x => [-2.85, 2.85].map(z => <group key={`${x}-${z}`}>
      <mesh position={[x, 0.5, z]} castShadow receiveShadow>
        <cylinderGeometry args={[0.22, 0.28, 0.18, 12]} />
        <meshStandardMaterial color="#92978d" roughness={0.88} />
      </mesh>
      <mesh position={[x, 2.04, z]} castShadow receiveShadow>
        <cylinderGeometry args={[0.12, 0.145, 2.92, 16]} />
        <meshStandardMaterial color="#655044" roughness={0.78} />
      </mesh>
      <mesh position={[x, 3.48, z]} castShadow>
        <boxGeometry args={[0.38, 0.18, 0.38]} />
        <meshStandardMaterial color="#655044" roughness={0.78} />
      </mesh>
      <Beam from={[x, 2.8, z]} to={[x - Math.sign(x) * 0.6, 3.4, z]} width={0.1} />
      <Beam from={[x, 2.8, z]} to={[x, 3.4, z - Math.sign(z) * 0.6]} width={0.1} />
    </group>))}

    {[-2.85, 2.85].map(v => <group key={v}>
      <Beam from={[-3.05, 3.48, v]} to={[3.05, 3.48, v]} width={0.19} depth={0.22} />
      <Beam from={[v, 3.48, -3.05]} to={[v, 3.48, 3.05]} width={0.19} depth={0.22} />
    </group>)}

    {/* Bench seating on three sides; the front remains open to the steps. */}
    {[0, 1, 3].map(side => <group key={side} rotation={[0, side * Math.PI / 2, 0]}>
      <mesh position={[0, 0.86, -2.75]} castShadow receiveShadow>
        <boxGeometry args={[5.25, 0.1, 0.42]} />
        <meshStandardMaterial color="#766050" roughness={0.8} />
      </mesh>
      {[-2.3, 0, 2.3].map(x => <Beam key={x} from={[x, 0.41, -2.75]} to={[x, 0.83, -2.75]} width={0.12} />)}
      <Beam from={[-2.7, 1.18, -2.91]} to={[2.7, 1.18, -2.91]} width={0.07} />
      {[-2.5, 0, 2.5].map(x => <Beam key={x} from={[x, 0.85, -2.91]} to={[x, 1.2, -2.91]} width={0.065} />)}
    </group>)}

    <group position={[0, EAVE_Y, 0]}>
      <mesh geometry={roof} castShadow receiveShadow>
        <meshStandardMaterial map={greyTiles} normalMap={tiles.normalMap}
          normalScale={new THREE.Vector2(0.45, 0.45)} color="#b7b8b6" roughness={0.96} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={roof} position={[0, -0.095, 0]} receiveShadow>
        <meshStandardMaterial color="#665448" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      {tileRolls.map((geometry, i) => <mesh key={`tile-roll-${i}`} geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial map={greyTiles} color="#adafac" roughness={0.96} />
      </mesh>)}
      {trims.map((trim, i) => <group key={i}>
        <mesh geometry={trim.edge} castShadow><meshStandardMaterial map={greyTiles} color="#a4a6a3" roughness={0.96} /></mesh>
        <mesh geometry={trim.hip} castShadow><meshStandardMaterial map={greyTiles} color="#b7b8b6" roughness={0.96} /></mesh>
      </group>)}
      <mesh position={[0, ROOF_RISE + 0.07, 0]} castShadow>
        <sphereGeometry args={[0.12, 12, 12]} />
        <meshStandardMaterial map={greyTiles} color="#b7b8b6" roughness={0.96} />
      </mesh>
    </group>

    {/* Broad entrance centered on the open side, aligned with the terrace. */}
    {[0, 1, 2].map(i => <mesh key={i} position={[0, 0.3 - i * 0.12, 3.65 + i * 0.4]} castShadow receiveShadow>
      <boxGeometry args={[2.6 + i * 0.18, 0.12, 0.55]} />
      <meshStandardMaterial {...floor} normalScale={new THREE.Vector2(0.35, 0.35)} roughness={0.92} />
    </mesh>)}
  </group>;
};
