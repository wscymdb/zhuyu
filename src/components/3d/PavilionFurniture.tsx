import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Small bevels catch the light without adding carved ornament or image textures.
function slab(width: number, height: number, depth: number, bevel = 0.005) {
  const shape = new THREE.Shape();
  const x = width / 2 - bevel, z = depth / 2 - bevel;
  shape.moveTo(-x, -z); shape.lineTo(x, -z); shape.lineTo(x, z); shape.lineTo(-x, z); shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: height - bevel * 2, bevelEnabled: true,
    bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, steps: 1, curveSegments: 1 });
  geo.rotateX(-Math.PI / 2); geo.translate(0, bevel - height / 2, 0);
  return geo;
}
function merge(parts: THREE.BufferGeometry[]) {
  const result = mergeGeometries(parts)!;
  parts.forEach(part => part.dispose());
  return result;
}
function timber(color: string, vertical = false) {
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.76, metalness: 0 });
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec3 timberPosition;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      timberPosition=(modelMatrix*vec4(transformed,1.0)).xyz;`);
    shader.fragmentShader = 'varying vec3 timberPosition;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float grain=sin(${vertical ? 'timberPosition.x*137.0+sin(timberPosition.y*7.0)*0.5+timberPosition.z*89.0' : 'timberPosition.z*173.0+sin(timberPosition.x*5.0)*0.6'});
      diffuseColor.rgb*=0.97+grain*0.025;`);
  };
  material.customProgramCacheKey = () => vertical ? 'furniture-vertical-grain' : 'furniture-horizontal-grain';
  return material;
}
function tableFrame() {
  const pieces: THREE.BufferGeometry[] = [];
  function beam(a: THREE.Vector3, b: THREE.Vector3, width: number, depth: number) {
    const direction = b.clone().sub(a);
    const geo = slab(width, direction.length(), depth, 0.004);
    geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()));
    geo.translate(...a.clone().add(b).multiplyScalar(0.5).toArray());
    pieces.push(geo);
  }
  // Four slender, slightly splayed legs instead of two solid pedestal blocks.
  for (const x of [-1, 1]) for (const z of [-1, 1]) {
    beam(new THREE.Vector3(x * 0.755, 0.018, z * 0.235), new THREE.Vector3(x * 0.70, 0.70, z * 0.20), 0.047, 0.047);
  }
  for (const z of [-0.20, 0.20]) {
    const apron = slab(1.45, 0.075, 0.026, 0.004); apron.translate(0, 0.653, z); pieces.push(apron);
  }
  for (const x of [-0.70, 0.70]) {
    const apron = slab(0.026, 0.075, 0.42, 0.004); apron.translate(x, 0.653, 0); pieces.push(apron);
    beam(new THREE.Vector3(x * 1.04, 0.18, -0.222), new THREE.Vector3(x * 1.04, 0.18, 0.222), 0.024, 0.028);
  }
  beam(new THREE.Vector3(-0.727, 0.23, -0.22), new THREE.Vector3(0.727, 0.23, -0.22), 0.023, 0.026);
  return merge(pieces);
}
function qinBody() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.63, -0.105);
  shape.quadraticCurveTo(-0.69, -0.10, -0.68, 0);
  shape.quadraticCurveTo(-0.69, 0.10, -0.63, 0.105);
  shape.bezierCurveTo(-0.47, 0.115, -0.35, 0.11, -0.27, 0.077);
  shape.bezierCurveTo(-0.17, 0.064, -0.12, 0.09, 0.02, 0.095);
  shape.bezierCurveTo(0.24, 0.10, 0.43, 0.078, 0.60, 0.069);
  shape.quadraticCurveTo(0.655, 0.066, 0.655, 0);
  shape.quadraticCurveTo(0.655, -0.066, 0.60, -0.069);
  shape.bezierCurveTo(0.43, -0.078, 0.24, -0.10, 0.02, -0.095);
  shape.bezierCurveTo(-0.12, -0.09, -0.17, -0.064, -0.27, -0.077);
  shape.bezierCurveTo(-0.35, -0.11, -0.47, -0.115, -0.63, -0.105);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.026, bevelEnabled: true,
    bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, steps: 1, curveSegments: 6 });
  geo.rotateX(-Math.PI / 2); geo.translate(0, -0.013, 0);
  return geo;
}

export const QinTable: React.FC<{ onPlay: (event: { stopPropagation: () => void }) => void }> = ({ onPlay }) => {
  const objects = useMemo(() => {
    const top = slab(1.90, 0.044, 0.66, 0.007);
    const frame = tableFrame(), qin = qinBody();
    const stringPoints: number[] = [];
    for (let i = 0; i < 7; i++) stringPoints.push(-0.595, 0.024, (i - 3) * 0.011, 0.595, 0.024, (i - 3) * 0.011);
    const strings = new THREE.BufferGeometry(); strings.setAttribute('position', new THREE.Float32BufferAttribute(stringPoints, 3));
    const dots: THREE.BufferGeometry[] = [];
    [-0.45, -0.38, -0.31, -0.23, -0.15, -0.08, 0, 0.08, 0.15, 0.23, 0.31, 0.38, 0.45].forEach(x => {
      const dot = new THREE.SphereGeometry(0.0032, 6, 4); dot.scale(1, 0.35, 1); dot.translate(x, 0.021, -0.071); dots.push(dot);
    });
    const cup = new THREE.LatheGeometry([
      new THREE.Vector2(0, 0), new THREE.Vector2(0.025, 0), new THREE.Vector2(0.034, 0.008),
      new THREE.Vector2(0.043, 0.045), new THREE.Vector2(0.039, 0.045),
      new THREE.Vector2(0.029, 0.009), new THREE.Vector2(0, 0.009),
    ], 20);
    return { top, frame, qin, strings, dots: merge(dots), cup,
      topMaterial: timber('#5d5042'), frameMaterial: timber('#4c4338', true), qinMaterial: timber('#292a23') };
  }, []);
  useEffect(() => () => {
    objects.top.dispose(); objects.frame.dispose(); objects.qin.dispose(); objects.strings.dispose(); objects.dots.dispose(); objects.cup.dispose();
    objects.topMaterial.dispose(); objects.frameMaterial.dispose(); objects.qinMaterial.dispose();
  }, [objects]);
  return <group position={[0, 0.41, -0.6]}>
    <mesh geometry={objects.top} material={objects.topMaterial} position={[0, 0.72, 0]} castShadow receiveShadow />
    <mesh geometry={objects.frame} material={objects.frameMaterial} castShadow receiveShadow />
    {[-0.46, 0.45].map(x => <mesh key={x} position={[x, 0.746, 0.035]}>
      <boxGeometry args={[0.09, 0.008, 0.23]} /><meshStandardMaterial color="#404239" roughness={1} />
    </mesh>)}
    <group position={[0, 0.77, 0.035]} onClick={onPlay}
      onPointerOver={event => { event.stopPropagation(); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = 'default'; }}>
      <mesh geometry={objects.qin} material={objects.qinMaterial} castShadow receiveShadow />
      <lineSegments geometry={objects.strings}><lineBasicMaterial color="#b4ab8e" /></lineSegments>
      <mesh geometry={objects.dots}><meshStandardMaterial color="#c9c6ad" roughness={0.6} /></mesh>
      {[-0.60, 0.60].map(x => <mesh key={x} position={[x, 0.021, 0]}>
        <boxGeometry args={[0.012, 0.01, 0.105]} /><meshStandardMaterial color="#665844" roughness={0.7} />
      </mesh>)}
    </group>
    {/* Keep the small objects on the rear corners, leaving the strings clear. */}
    <group position={[-0.77, 0.743, -0.20]}>
      <mesh position={[0, 0.006, 0]} receiveShadow><cylinderGeometry args={[0.065, 0.053, 0.01, 20]} />
        <meshStandardMaterial color="#8f9b8c" roughness={0.38} /></mesh>
      <mesh geometry={objects.cup} position={[0, 0.012, 0]} castShadow>
        <meshStandardMaterial color="#a7b19e" roughness={0.32} /></mesh>
      <mesh position={[0, 0.052, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.035, 20]} /><meshStandardMaterial color="#574a30" roughness={0.24} /></mesh>
    </group>

  </group>;
};

export const TraditionalLantern: React.FC = () => {
  const frame = useMemo(() => {
    const pieces: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = i / 6 * Math.PI * 2;
      const post = new THREE.CylinderGeometry(0.0045, 0.0045, 0.22, 5);
      post.translate(Math.sin(angle) * 0.097, 0.14, Math.cos(angle) * 0.097);
      pieces.push(post);
    }
    return merge(pieces);
  }, []);
  useEffect(() => () => frame.dispose(), [frame]);
  // A small portable six-sided paper lantern stands on the rear corner of the
  // qin table. There is no ceiling cord, spotlight or suspended lamp shade.
  return <group position={[0.77, 1.154, -0.79]} rotation={[0, Math.PI / 6, 0]}>
    <mesh position={[0, 0.012, 0]} castShadow>
      <cylinderGeometry args={[0.108, 0.119, 0.024, 6]} />
      <meshStandardMaterial color="#514536" roughness={0.84} />
    </mesh>
    <mesh position={[0, 0.034, 0]}>
      <cylinderGeometry args={[0.103, 0.103, 0.018, 6]} />
      <meshStandardMaterial color="#64513a" roughness={0.82} />
    </mesh>
    <mesh position={[0, 0.14, 0]}>
      <cylinderGeometry args={[0.094, 0.094, 0.20, 6, 1, true]} />
      <meshStandardMaterial color="#d7c8a7" emissive="#e6b779" emissiveIntensity={0.22}
        roughness={0.98} side={THREE.DoubleSide} />
    </mesh>
    <mesh geometry={frame}><meshStandardMaterial color="#695238" roughness={0.85} /></mesh>
    <mesh position={[0, 0.249, 0]}>
      <cylinderGeometry args={[0.112, 0.105, 0.018, 6]} />
      <meshStandardMaterial color="#574733" roughness={0.85} />
    </mesh>
    <mesh position={[0, 0.284, 0]}>
      <cylinderGeometry args={[0.042, 0.119, 0.052, 6]} />
      <meshStandardMaterial color="#4f4333" roughness={0.86} />
    </mesh>
    <mesh position={[0, 0.316, 0]}>
      <cylinderGeometry args={[0.045, 0.045, 0.012, 6]} />
      <meshStandardMaterial color="#635039" roughness={0.84} />
    </mesh>
    <mesh position={[0, 0.349, 0]}>
      <torusGeometry args={[0.032, 0.0032, 6, 20]} />
      <meshStandardMaterial color="#4f493a" metalness={0.25} roughness={0.65} />
    </mesh>
    <pointLight position={[0, 0.13, 0]} color="#ffd79e" intensity={0.9} distance={4} decay={2} />
  </group>;
};
