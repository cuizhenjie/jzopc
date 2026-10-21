'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import { Color } from 'three';
import { brand } from '@/lib/site/config';

/** A soft halo in the same renderer, behind the particle sculpture. */
export default function HeroBackdrop() {
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uBlue: { value: new Color(brand.blue) },
    uTeal: { value: new Color(brand.teal) },
  }), []);
  useFrame((_, delta) => { uniforms.uTime.value += Math.min(delta, 0.05); });
  return (
    <mesh position={[0, 0, -2]}>
      <planeGeometry args={[8, 8]} />
      <shaderMaterial
        transparent
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={/* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={/* glsl */ `
          uniform float uTime;
          uniform vec3 uBlue;
          uniform vec3 uTeal;
          varying vec2 vUv;
          void main() {
            vec2 p = (vUv - 0.5) * 2.0;
            float halo = exp(-dot(p, p) * 5.0);
            float drift = 0.5 + 0.5 * sin(p.x * 2.0 + uTime * 0.12);
            gl_FragColor = vec4(mix(uBlue, uTeal, drift), halo * 0.12);
          }
        `}
      />
    </mesh>
  );
}
