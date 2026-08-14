"use client";

import { useRef, useMemo, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

// ---------------------------------------------------------------------------
// Earth sphere with procedural agricultural-green landmass coloring
// ---------------------------------------------------------------------------
function EarthSphere() {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  useFrame((_, delta) => {
    if (meshRef.current) meshRef.current.rotation.y += delta * 0.15;
    if (materialRef.current) materialRef.current.uniforms.uTime.value += delta;
  });

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
    }),
    [],
  );

  const vertexShader = /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec2 vUv;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vPosition = position;
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec2 vUv;
    uniform float uTime;

    // Simple 2D noise
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), f.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
        f.y
      );
    }

    void main() {
      // Use spherical UV-like coords from position
      float theta = atan(vPosition.z, vPosition.x);
      float phi = acos(vPosition.y / length(vPosition));

      vec2 uv = vec2(theta / (2.0 * 3.14159265) + 0.5, phi / 3.14159265);
      float n = noise(uv * 24.0) * 0.5 + noise(uv * 12.0) * 0.3 + noise(uv * 6.0) * 0.2;

      // Agricultural greens palette
      vec3 landLow   = vec3(0.06, 0.28, 0.13);  // dark forest green
      vec3 landMid   = vec3(0.13, 0.45, 0.18);  // farm green
      vec3 landHigh  = vec3(0.55, 0.72, 0.25);  // crop / lime
      vec3 ocean     = vec3(0.08, 0.18, 0.30);  // deep blue

      // Mix land vs ocean based on noise
      float landMask = smoothstep(0.3, 0.55, n);
      vec3 landColor = mix(landLow, landMid, smoothstep(0.35, 0.55, n));
      landColor = mix(landColor, landHigh, smoothstep(0.55, 0.7, n));

      vec3 baseColor = mix(ocean, landColor, landMask);

      // Subtle rim lighting
      float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.5);
      baseColor += fresnel * 0.1 * vec3(0.6, 0.85, 0.4);

      gl_FragColor = vec4(baseColor, 0.92);
    }
  `;

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[2.0, 64, 64]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
      />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Satellite orbit ring
// ---------------------------------------------------------------------------
function OrbitRing({ radius, tilt, speed, color }: { radius: number; tilt: number; speed: number; color: string }) {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (ringRef.current) ringRef.current.rotation.y += delta * speed;
  });

  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 128; i++) {
      const angle = (i / 128) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
    }
    return pts;
  }, [radius]);

  const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);

  return (
    <group rotation={[tilt, 0, 0]}>
      {/* @ts-expect-error: Line geometry from BufferGeometry is valid */}
      <line ref={ringRef} geometry={geometry}>
        <lineBasicMaterial color={color} transparent opacity={0.5} />
      </line>
      <mesh>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Background star particles
// ---------------------------------------------------------------------------
function Stars() {
  const pointsRef = useRef<THREE.Points>(null);

  // Random star positions are generated once via a lazy state initializer so
  // the impure Math.random calls never run during render.
  const [positions] = useState(() => {
    const pos: number[] = [];
    for (let i = 0; i < 200; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 6 + Math.random() * 4;
      pos.push(r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi));
    }
    return new Float32Array(pos);
  });

  useFrame((_, delta) => {
    if (pointsRef.current) pointsRef.current.rotation.y += delta * 0.02;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.025} color="#c8e6c9" transparent opacity={0.6} sizeAttenuation />
    </points>
  );
}

// ---------------------------------------------------------------------------
// Scene composition
// ---------------------------------------------------------------------------
function Scene() {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 3, 5]} intensity={0.6} color="#ffffff" />
      <EarthSphere />
      <OrbitRing radius={2.4} tilt={0.9} speed={0.4} color="#4ade80" />
      <OrbitRing radius={2.7} tilt={1.7} speed={-0.3} color="#86efac" />
      <OrbitRing radius={2.55} tilt={2.4} speed={0.25} color="#bbf7d0" />
      <Stars />
      <OrbitControls enableZoom={false} enablePan={false} enableRotate={false} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Exported component — wraps Canvas in a responsive container
// ---------------------------------------------------------------------------
export default function ThreeGlobe() {
  return (
    <div className="pointer-events-none absolute inset-0 h-full w-full">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 45 }}
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 1.5]}
        style={{ background: "transparent" }}
      >
        <Scene />
      </Canvas>
    </div>
  );
}