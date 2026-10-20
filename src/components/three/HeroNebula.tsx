'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { brandRamp, curlNoise, simplex3d } from './shaders/noise.glsl';

const vertexShader = /* glsl */ `
${simplex3d}
${curlNoise}

uniform float uTime;
uniform vec2  uPointer;
uniform float uPixelRatio;

attribute vec3 aSeed;   // x: 初始相位  y: 噪声频率  z: 亮度权重

varying float vBright;
varying float vRadius;

void main() {
  float t = uTime * 0.12 + aSeed.x * 6.2831;

  vec3 p = position;

  // 无散度噪声场推力：粒子沿旋涡流动而非直冲
  p += curl(p * aSeed.y, t) * 0.62;

  // 向心引力：表达「众智汇聚」
  float len = length(p);
  p += normalize(-p + 1e-5) * (0.40 / (len + 0.6));

  // 指针引力：轻微偏移，不改变构图
  p.xy += uPointer * 0.07;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);

  vBright = aSeed.z;
  vRadius = clamp(len / 5.0, 0.0, 1.0);

  gl_PointSize = (2.6 + aSeed.z * 5.4) * uPixelRatio * (5.2 / max(-mv.z, 0.1));
  gl_Position = projectionMatrix * mv;
}
`;

const fragmentShader = /* glsl */ `
${brandRamp}

varying float vBright;
varying float vRadius;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  if (d > 0.5) discard;

  // 软圆点 + 中心亮核
  float soft = smoothstep(0.5, 0.06, d);
  float core = smoothstep(0.22, 0.0, d);

  // 越靠近中心越亮、越偏主蓝；外围偏青绿
  float t = mix(1.0 - vRadius, 0.35 + vRadius * 0.6, 0.5);
  vec3 col = brandRamp(clamp(t + vBright * 0.18, 0.0, 1.0));

  float alpha = soft * (0.10 + vBright * 0.26) + core * 0.16;
  gl_FragColor = vec4(col * (0.62 + core * 0.75), alpha);
}
`;

/**
 * Hero「众智星云」粒子层。
 * 运动全部在顶点着色器内完成，CPU 每帧只更新两个 uniform。
 */
export default function HeroNebula({
  count = 24000,
  pointer = { x: 0, y: 0 },
}: {
  count?: number;
  pointer?: { x: number; y: number };
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const pointerRef = useRef(pointer);
  pointerRef.current = pointer;

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      // 球壳分布，中心留空形成「星云核」
      const r = 0.9 + Math.pow(Math.random(), 0.55) * 4.4;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const sinPhi = Math.sin(phi);

      positions[i * 3] = r * sinPhi * Math.cos(theta);
      positions[i * 3 + 1] = r * sinPhi * Math.sin(theta) * 0.72; // 压扁，更像星盘
      positions[i * 3 + 2] = r * Math.cos(phi);

      seeds[i * 3] = Math.random();
      seeds[i * 3 + 1] = 0.18 + Math.random() * 0.34;
      seeds[i * 3 + 2] = Math.random();
    }

    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
    return g;
  }, [count]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPointer: { value: new THREE.Vector2(0, 0) },
      uPixelRatio: { value: Math.min(typeof window === 'undefined' ? 1 : window.devicePixelRatio, 1.5) },
    }),
    [],
  );

  useFrame((state, delta) => {
    const mat = matRef.current;
    if (!mat) return;
    mat.uniforms.uTime.value += Math.min(delta, 0.05);
    const target = pointerRef.current;
    mat.uniforms.uPointer.value.x += (target.x - mat.uniforms.uPointer.value.x) * 0.05;
    mat.uniforms.uPointer.value.y += (target.y - mat.uniforms.uPointer.value.y) * 0.05;
    // 轻微自转，增强生命感
    state.scene.rotation.y += delta * 0.012;
  });

  return (
    <points frustumCulled={false} position={[1.5, 0, 0]}>
      <primitive object={geometry} attach="geometry" />
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
