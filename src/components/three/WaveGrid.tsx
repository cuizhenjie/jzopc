'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { brandRamp, simplex3d } from './shaders/noise.glsl';

/**
 * 「数字海洋」：一张俯视透视的点阵海面，多组低频行波叠加驱动起伏（openhex
 * wave-grid 的呼吸感），波峰更亮、波谷更暗，光随之在表面流动。
 * 与 HeroNebula 的分工：雕塑是首屏焦点，这片海是全页 fixed 背景层的氛围底。
 */

const PLANE_W = 34;
const PLANE_Z_NEAR = 7.5;
const PLANE_Z_FAR = -6;

const vertexShader = /* glsl */ `
uniform float uTime;
uniform vec2 uRipple;
uniform float uRippleStrength;
uniform float uPixelRatio;
attribute vec3 aSeed;
varying float vElev;
varying float vFog;
varying float vEdge;
${simplex3d}
void main() {
  vec3 p = position;
  p.x += aSeed.x;
  p.z += aSeed.y;
  // Distant water reads calmer: damp the swell toward the horizon.
  float ampScale = 0.55 + 0.45 * smoothstep(-7.0, 1.0, p.z);
  float h = 0.34 * sin(dot(p.xz, vec2(0.94, 0.33)) * 0.40 + uTime * 0.10);
  h += 0.21 * sin(dot(p.xz, vec2(-0.53, 0.85)) * 0.66 - uTime * 0.135 + 2.1);
  h += 0.115 * sin(dot(p.xz, vec2(0.83, -0.55)) * 1.12 + uTime * 0.19 + 4.4);
  h *= ampScale;
  // A whisper of noise so the field never reads as pure sine stripes.
  h += 0.05 * snoise(vec3(p.x * 0.32, p.z * 0.32, uTime * 0.05));
  float rippleD = distance(p.xz, uRipple);
  h += uRippleStrength * 0.26 * exp(-rippleD * rippleD * 0.6) * sin(rippleD * 6.5 - uTime * 3.4);
  p.y = h;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float viewDistRaw = -mv.z;
  // Points at/behind the camera project garbage (w<0) — zero-size them out.
  float behind = step(viewDistRaw, 0.5);
  float viewDist = max(viewDistRaw, 0.8);
  vElev = clamp(h * 0.75 + 0.5, 0.0, 1.0);
  // 雾距按相机到海面对角的实际视距标定（远角 ≈17.5）：中景保留、地平线渐隐
  vFog = (1.0 - smoothstep(13.0, 19.5, viewDist)) * (1.0 - behind);
  vEdge = smoothstep(17.0, 13.0, abs(p.x));
  float size = (1.3 + vElev * 1.9) * uPixelRatio * (9.5 / viewDist);
  gl_PointSize = (1.0 - behind) * clamp(size, 1.4 * uPixelRatio, 10.0 * uPixelRatio);
  gl_Position = projectionMatrix * mv;
}
`;

const fragmentShader = /* glsl */ `
${brandRamp}
varying float vElev;
varying float vFog;
varying float vEdge;
void main() {
  float distanceToCenter = length(gl_PointCoord - 0.5);
  if (distanceToCenter > 0.5) discard;
  float point = 1.0 - smoothstep(0.10, 0.50, distanceToCenter);
  // Valleys sink toward brand navy, crests climb the ramp to cyan.
  vec3 color = brandRamp(0.24 + vElev * 0.76);
  color += vec3(0.13, 0.2, 0.22) * smoothstep(0.84, 1.0, vElev);
  float alpha = point * (0.26 + vElev * 0.56) * vFog * vEdge;
  gl_FragColor = vec4(color, min(alpha, 0.82));
}
`;

export default function WaveGrid({ count = 12000, pointerRef }: {
  count?: number;
  pointerRef: RefObject<{ x: number; y: number }>;
}) {
  const camera = useThree((state) => state.camera);
  useEffect(() => {
    camera.lookAt(0, -0.5, -1);
  }, [camera]);

  const geometry = useMemo(() => {
    const result = new THREE.BufferGeometry();
    const cols = Math.max(24, Math.round(Math.sqrt(count * (PLANE_W / (PLANE_Z_NEAR - PLANE_Z_FAR)))));
    const rows = Math.max(16, Math.round(count / cols));
    const positions = new Float32Array(cols * rows * 3);
    const seeds = new Float32Array(cols * rows * 3);
    let offset = 0;
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        // Deterministic jitter keeps the lattice alive without frame randomness.
        const jitterX = Math.sin(offset * 12.9898) * 0.28;
        const jitterZ = Math.sin(offset * 78.233) * 0.28;
        positions[offset] = -PLANE_W / 2 + (col / (cols - 1)) * PLANE_W;
        positions[offset + 1] = 0;
        positions[offset + 2] = PLANE_Z_FAR + (row / (rows - 1)) * (PLANE_Z_NEAR - PLANE_Z_FAR);
        seeds[offset] = jitterX;
        seeds[offset + 1] = jitterZ;
        seeds[offset + 2] = (Math.sin(offset * 3.7) + 1) / 2;
        offset += 3;
      }
    }
    result.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    result.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
    return result;
  }, [count]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uRipple: { value: new THREE.Vector2(0, 3) },
    uRippleStrength: { value: 0 },
    uPixelRatio: { value: 1 },
  }), []);

  useFrame((state, delta) => {
    const step = Math.min(delta, 0.05);
    uniforms.uTime.value += step;
    uniforms.uPixelRatio.value = state.gl.getPixelRatio();
    // Map viewport NDC onto the sea plane; the ripple center glides after the pointer.
    const targetX = pointerRef.current.x * 9.0;
    const targetZ = 2.6 - pointerRef.current.y * 4.8;
    uniforms.uRipple.value.x += (targetX - uniforms.uRipple.value.x) * 0.06;
    uniforms.uRipple.value.y += (targetZ - uniforms.uRipple.value.y) * 0.06;
    uniforms.uRippleStrength.value += (1.0 - uniforms.uRippleStrength.value) * 0.02;
  });

  return (
    <points frustumCulled={false}>
      <primitive object={geometry} attach="geometry" />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
