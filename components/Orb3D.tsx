"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";

type Orb3DProps = {
  speakingLevel?: number;
};

function GeoCore({ speakingLevel = 0.08 }: Orb3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const shellRef = useRef<THREE.Mesh>(null);
  const wireRef = useRef<THREE.Mesh>(null);
  const pointsRef = useRef<THREE.Points>(null);

  const geometry = useMemo(() => {
    // menos subdivisão = menos bolinhas e visual mais limpo
    return new THREE.IcosahedronGeometry(1.34, 6);
  }, []);

  const directions = useMemo(() => {
    const pos = geometry.attributes.position.array as Float32Array;
    const dirs = new Float32Array(pos.length);

    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i];
      const y = pos[i + 1];
      const z = pos[i + 2];
      const len = Math.sqrt(x * x + y * y + z * z) || 1;

      dirs[i] = x / len;
      dirs[i + 1] = y / len;
      dirs[i + 2] = z / len;
    }

    return dirs;
  }, [geometry]);

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();
    const level = Math.max(0.03, Math.min(1, speakingLevel));

    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.22;
      groupRef.current.rotation.x = 0.28 + Math.sin(t * 0.45) * 0.1;
      groupRef.current.rotation.z = Math.sin(t * 0.28) * 0.04;
      groupRef.current.position.y = Math.sin(t * 0.85) * 0.04;
      groupRef.current.position.x = Math.cos(t * 0.4) * 0.02;
    }

    const pos = geometry.attributes.position.array as Float32Array;

    for (let i = 0; i < pos.length; i += 3) {
      const nx = directions[i];
      const ny = directions[i + 1];
      const nz = directions[i + 2];

      const wave1 = Math.sin(t * 1.05 + nx * 2.8 + ny * 2.3);
      const wave2 = Math.cos(t * 1.35 + ny * 3.2 + nz * 2.8);

      const idle = wave1 * 0.015 + wave2 * 0.012;
      const speech = level * (0.02 + Math.abs(wave1) * 0.02);

      const radius = 1.28 + idle + speech * 0.35;

      pos[i] = nx * radius;
      pos[i + 1] = ny * radius;
      pos[i + 2] = nz * radius;
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();

    if (shellRef.current) {
      shellRef.current.scale.setScalar(1 + level * 0.025);
    }

    if (wireRef.current) {
      wireRef.current.scale.setScalar(1.008 + level * 0.015);
    }

    if (pointsRef.current) {
      pointsRef.current.scale.setScalar(1.01 + level * 0.02);
    }
  });

  return (
    <group ref={groupRef} position={[0, 0.18, 0]} scale={1.12}>
      {/* glow de base */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -2.1, 0]}>
        <circleGeometry args={[1.05, 64]} />
        <meshBasicMaterial color="#4be0ff" transparent opacity={0.07} depthWrite={false} />
      </mesh>

      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -2.08, 0]}>
        <ringGeometry args={[0.72, 1.45, 80]} />
        <meshBasicMaterial color="#63ecff" transparent opacity={0.13} depthWrite={false} />
      </mesh>

      {/* atmosfera suave */}
      <mesh scale={1.08} frustumCulled={false}>
        <sphereGeometry args={[1.42, 48, 48]} />
        <meshBasicMaterial
          color="#4bdfff"
          transparent
          opacity={0.045}
          depthWrite={false}
        />
      </mesh>

      {/* esfera base */}
      <mesh ref={shellRef} geometry={geometry} frustumCulled={false}>
        <meshPhysicalMaterial
          color="#081a31"
          emissive="#57e7ff"
          emissiveIntensity={0.28}
          transparent
          opacity={0.22}
          roughness={0.3}
          metalness={0.02}
          clearcoat={0.45}
          clearcoatRoughness={0.22}
          depthWrite={false}
        />
      </mesh>

      {/* wireframe azul leve */}
      <mesh ref={wireRef} geometry={geometry} frustumCulled={false}>
        <meshBasicMaterial
          color="#63ecff"
          wireframe
          transparent
          opacity={0.16}
          depthWrite={false}
        />
      </mesh>

      {/* pontos: menos quantidade visual e mais azul */}
      <points ref={pointsRef} geometry={geometry} frustumCulled={false}>
        <pointsMaterial
          color="#8df4ff"
          size={0.028}
          transparent
          opacity={0.86}
          sizeAttenuation
          depthWrite={false}
        />
      </points>

      {/* núcleo */}
      <mesh>
        <sphereGeometry args={[0.16, 32, 32]} />
        <meshBasicMaterial color="#7ff2ff" />
      </mesh>

      <mesh>
        <sphereGeometry args={[0.32, 32, 32]} />
        <meshBasicMaterial color="#63ecff" transparent opacity={0.12} depthWrite={false} />
      </mesh>

      <mesh>
        <sphereGeometry args={[0.54, 32, 32]} />
        <meshBasicMaterial color="#63ecff" transparent opacity={0.035} depthWrite={false} />
      </mesh>
    </group>
  );
}

export default function Orb3D({ speakingLevel = 0.08 }: Orb3DProps) {
  return (
    <div className="orb3dWrap">
      <Canvas
        camera={{ position: [0, 0.05, 5.6], fov: 36 }}
        gl={{ alpha: true, antialias: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 3, 3]} intensity={1.0} color="#c4fbff" />
        <pointLight position={[0, 0.4, 2.6]} intensity={1.7} color="#63ecff" />
        <pointLight position={[0, -1.4, 1.2]} intensity={0.7} color="#5acfff" />

        <Float speed={1.0} rotationIntensity={0.05} floatIntensity={0.08}>
          <GeoCore speakingLevel={speakingLevel} />
        </Float>
      </Canvas>

      <div className="orbOverlay">
        <p>HOLOGRAPHIC CORE</p>
        <strong>ORION</strong>
      </div>

      <style jsx>{`
        .orb3dWrap {
          position: relative;
          width: 100%;
          height: 100%;
          min-height: 100%;
        }

        .orbOverlay {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, 96px);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          text-align: center;
          width: 100%;
        }

        .orbOverlay p {
          margin: 0 0 14px 0;
          color: rgba(220, 245, 255, 0.72);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.28em;
        }

        .orbOverlay strong {
          color: #eafcff;
          font-size: 34px;
          font-weight: 900;
          letter-spacing: 0.28em;
          text-shadow: 0 0 24px rgba(97, 239, 255, 0.16);
        }
      `}</style>
    </div>
  );
}