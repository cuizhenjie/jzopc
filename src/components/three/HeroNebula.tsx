'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { brandRamp } from './shaders/noise.glsl';

const vertexShader = /* glsl */ `
uniform float uTime;
uniform vec2 uPointer;
uniform float uPixelRatio;
attribute vec3 aSeed;
varying float vLight;
varying float vColor;
void main() {
  vec3 p = position;
  // Keep the silhouette steady: a slight breathing wave, no sprawling noise field.
  float wave = sin(p.y * 3.2 + p.x * 1.8 + uTime * 0.32 + aSeed.x * 2.0);
  p *= 1.0 + wave * 0.014;
  p.xy += uPointer * 0.055;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vLight = (0.35 + aSeed.z * 0.65) * mix(0.48, 1.0, smoothstep(-1.8, 1.8, p.z));
  vColor = aSeed.y;
  gl_PointSize = (1.3 + aSeed.z * 1.65) * uPixelRatio * (5.0 / max(-mv.z, 0.1));
  gl_Position = projectionMatrix * mv;
}
`;

const fragmentShader = /* glsl */ `
${brandRamp}
varying float vLight;
varying float vColor;
void main() {
  float distanceToCenter = length(gl_PointCoord - 0.5);
  if (distanceToCenter > 0.5) discard;
  float point = 1.0 - smoothstep(0.10, 0.50, distanceToCenter);
  // Logo teal and the light cyan gradient endpoint keep the front face legible.
  vec3 teal = vec3(0.341, 0.714, 0.647);
  vec3 lightCyan = vec3(0.392, 0.769, 0.851);
  vec3 accent = mix(teal, lightCyan, vColor * 0.38);
  float front = smoothstep(0.35, 0.85, vLight);
  vec3 color = mix(brandRamp(vColor), accent, 0.60 + front * 0.18);
  gl_FragColor = vec4(color, min(point * vLight * 1.12, 0.95));
}
`;

/** A spherical field and gathering orbit, centered inside the Hero's dedicated visual column. */
export default function HeroNebula({ count = 12000, pointerRef }: {
  count?: number;
  pointerRef: RefObject<{ x: number; y: number }>;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const geometry = useMemo(() => {
    const result = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count * 3);
    const shellCount = Math.floor(count * 0.82);
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for (let index = 0; index < count; index += 1) {
      // Deterministic points keep the overall distribution consistent between mounts.
      const seed = ((index * 16807) % 2147483647) / 2147483647;
      const phase = index * goldenAngle;
      const offset = index * 3;
      if (index < shellCount) {
        const y = 1 - 2 * ((index + 0.5) / shellCount);
        const radius = 1.85 + Math.sin(index * 7.13) * 0.055;
        const radial = Math.sqrt(1 - y * y);
        positions[offset] = Math.cos(phase) * radial * radius;
        positions[offset + 1] = y * radius;
        positions[offset + 2] = Math.sin(phase) * radial * radius;
      } else {
        const angle = ((index - shellCount) / (count - shellCount)) * Math.PI * 2;
        const spread = Math.sin(index * 13.17) * 0.045;
        positions[offset] = (2.35 + spread) * Math.cos(angle);
        positions[offset + 1] = 0.58 * Math.sin(angle) + 0.38 * Math.cos(angle) + spread;
        positions[offset + 2] = 1.12 * Math.sin(angle);
      }
      seeds[offset] = seed;
      seeds[offset + 1] = 0.47 + ((Math.sin(index * 1.97) + 1) / 2) * 0.48;
      seeds[offset + 2] = 0.3 + ((Math.sin(index * 3.71) + 1) / 2) * 0.7;
    }
    result.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    result.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
    return result;
  }, [count]);

  // Primitive geometries are owned here; R3F disposes the declarative material.
  useEffect(() => () => geometry.dispose(), [geometry]);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uPointer: { value: new THREE.Vector2() },
    uPixelRatio: { value: 1 },
  }), []);
  useFrame((state, delta) => {
    const step = Math.min(delta, 0.05);
    uniforms.uTime.value += step;
    uniforms.uPixelRatio.value = state.gl.getPixelRatio();
    uniforms.uPointer.value.x += (pointerRef.current.x - uniforms.uPointer.value.x) * 0.045;
    uniforms.uPointer.value.y += (pointerRef.current.y - uniforms.uPointer.value.y) * 0.045;
    // Only the sculpture rotates; the backdrop and camera retain their alignment.
    if (pointsRef.current) pointsRef.current.rotation.y += step * 0.022;
  });
  return (
    <points ref={pointsRef} frustumCulled={false} rotation={[0.08, 0, -0.12]}>
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
