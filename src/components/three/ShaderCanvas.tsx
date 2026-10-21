'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useRef, type ReactNode } from 'react';
import type { DeviceProfile } from './quality';

type ShaderCanvasProps = {
  children: ReactNode;
  profile: DeviceProfile;
  active: boolean;
  onReady: () => void;
  onContextLost: () => void;
};

function SceneLifecycle({ onReady, onContextLost }: Pick<ShaderCanvasProps, 'onReady' | 'onContextLost'>) {
  const gl = useThree((state) => state.gl);
  const frames = useRef(0);
  useEffect(() => {
    const canvas = gl.domElement;
    const handleLost = (event: Event) => {
      event.preventDefault();
      onContextLost();
    };
    const previousShaderError = gl.debug.onShaderError;
    gl.debug.onShaderError = () => onContextLost();
    canvas.dataset.renderFrames = '0';
    canvas.addEventListener('webglcontextlost', handleLost);
    return () => {
      canvas.removeEventListener('webglcontextlost', handleLost);
      gl.debug.onShaderError = previousShaderError;
    };
    // Canvas owns renderer disposal + context release on unmount. Disposing it here
    // would destroy the live renderer during React Strict Mode's effect replay.
  }, [gl, onContextLost]);
  useFrame(() => {
    frames.current += 1;
    if (frames.current === 1) onReady();
    if (frames.current === 1 || frames.current % 30 === 0) {
      gl.domElement.dataset.renderFrames = String(frames.current);
    }
  });
  return null;
}

/** Receives the existing device profile: no duplicate GPU capability probes. */
export default function ShaderCanvas({ children, profile, active, onReady, onContextLost }: ShaderCanvasProps) {
  if (!profile.hasWebGL2 || profile.tier === 'static') return null;
  return (
    <Canvas
      dpr={profile.dpr}
      frameloop={active ? 'always' : 'never'}
      gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}
      camera={{ position: [0, 0, 6], fov: 44, near: 0.1, far: 20 }}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    >
      <SceneLifecycle onReady={onReady} onContextLost={onContextLost} />
      <Suspense fallback={null}>{children}</Suspense>
    </Canvas>
  );
}
