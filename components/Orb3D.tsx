"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";

type OrbMode = "idle" | "processing" | "speaking" | "listening";

type Orb3DProps = {
  speakingLevel?: number;
  mode?: OrbMode;
};

function getModeConfig(mode: OrbMode) {
  if (mode === "listening") {
    return {
      color: "#56ffd0",
      secondary: "#63ecff",
      label: "LISTENING",
      speed: 1.15,
      deform: 1.1,
      glow: 0.18,
    };
  }

  if (mode === "speaking") {
    return {
      color: "#63ecff",
      secondary: "#8df4ff",
      label: "SPEAKING",
      speed: 1.3,
      deform: 1.65,
      glow: 0.24,
    };
  }

  if (mode === "processing") {
    return {
      color: "#8d7dff",
      secondary: "#63ecff",
      label: "ANALYZING",
      speed: 1.55,
      deform: 0.95,
      glow: 0.2,
    };
  }

  return {
    color: "#63ecff",
    secondary: "#8df4ff",
    label: "IDLE",
    speed: 0.75,
    deform: 0.55,
    glow: 0.12,
  };
}

function GeoCore({ speakingLevel = 0.06, mode = "idle" }: Orb3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const shellRef = useRef<THREE.Mesh>(null);
  const wireRef = useRef<THREE.Mesh>(null);
  const pointsRef = useRef<THREE.Points>(null);
  const auraRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);

  const geometry = useMemo(() => {
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
    const config = getModeConfig(mode);
    const level = Math.max(0.025, Math.min(1, speakingLevel));

    const modePulse =
      mode === "processing"
        ? 0.12 + Math.abs(Math.sin(t * 2.2)) * 0.1
        : mode === "listening"
        ? 0.08 + Math.abs(Math.sin(t * 3.4)) * 0.12
        : 0;

    const activeLevel = Math.min(1, level + modePulse);

    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.22 * config.speed;
      groupRef.current.rotation.x = 0.28 + Math.sin(t * 0.45) * 0.1;
      groupRef.current.rotation.z = Math.sin(t * 0.28) * 0.05;
      groupRef.current.position.y = Math.sin(t * 0.85) * 0.045;
      groupRef.current.position.x = Math.cos(t * 0.4) * 0.018;
    }

    const pos = geometry.attributes.position.array as Float32Array;

    for (let i = 0; i < pos.length; i += 3) {
      const nx = directions[i];
      const ny = directions[i + 1];
      const nz = directions[i + 2];

      const wave1 = Math.sin(t * 1.05 + nx * 2.8 + ny * 2.3);
      const wave2 = Math.cos(t * 1.35 + ny * 3.2 + nz * 2.8);
      const wave3 = Math.sin(t * 1.85 + nz * 3.1 + nx * 1.8);

      const idleDeform = wave1 * 0.014 + wave2 * 0.011;
      const voiceDeform =
        activeLevel * config.deform * (0.018 + Math.abs(wave3) * 0.032);

      const radius = 1.28 + idleDeform + voiceDeform;

      pos[i] = nx * radius;
      pos[i + 1] = ny * radius;
      pos[i + 2] = nz * radius;
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();

    const scalePulse =
      1 +
      activeLevel *
        (mode === "speaking" ? 0.075 : mode === "listening" ? 0.055 : 0.035);

    if (shellRef.current) {
      shellRef.current.scale.setScalar(scalePulse);
    }

    if (wireRef.current) {
      wireRef.current.scale.setScalar(1.01 + activeLevel * 0.035);
    }

    if (pointsRef.current) {
      pointsRef.current.scale.setScalar(1.015 + activeLevel * 0.05);
    }

    if (auraRef.current) {
      auraRef.current.scale.setScalar(1.1 + activeLevel * 0.16);
    }

    if (coreRef.current) {
      coreRef.current.scale.setScalar(1 + activeLevel * 0.2);
    }
  });

  const config = getModeConfig(mode);

  return (
    <group ref={groupRef} position={[0, 0.18, 0]} scale={1.18}>
      {/* base holográfica */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -2.1, 0]}>
        <circleGeometry args={[1.08, 64]} />
        <meshBasicMaterial
          color={config.color}
          transparent
          opacity={0.055 + config.glow * 0.18}
          depthWrite={false}
        />
      </mesh>

      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -2.08, 0]}>
        <ringGeometry args={[0.72, 1.45, 96]} />
        <meshBasicMaterial
          color={config.color}
          transparent
          opacity={0.11 + config.glow * 0.2}
          depthWrite={false}
        />
      </mesh>

      {/* aura externa */}
      <mesh ref={auraRef} scale={1.08} frustumCulled={false}>
        <sphereGeometry args={[1.44, 48, 48]} />
        <meshBasicMaterial
          color={config.color}
          transparent
          opacity={0.035 + config.glow * 0.08}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* corpo translúcido */}
      <mesh ref={shellRef} geometry={geometry} frustumCulled={false}>
        <meshPhysicalMaterial
          color="#06172d"
          emissive={config.color}
          emissiveIntensity={mode === "idle" ? 0.22 : 0.35}
          transparent
          opacity={0.18}
          roughness={0.35}
          metalness={0.02}
          clearcoat={0.45}
          clearcoatRoughness={0.25}
          depthWrite={false}
        />
      </mesh>

      {/* wireframe */}
      <mesh ref={wireRef} geometry={geometry} frustumCulled={false}>
        <meshBasicMaterial
          color={config.color}
          wireframe
          transparent
          opacity={mode === "idle" ? 0.13 : 0.2}
          depthWrite={false}
        />
      </mesh>

      {/* pontos */}
      <points ref={pointsRef} geometry={geometry} frustumCulled={false}>
        <pointsMaterial
          color={config.secondary}
          size={mode === "speaking" ? 0.032 : 0.027}
          transparent
          opacity={mode === "idle" ? 0.62 : 0.86}
          sizeAttenuation
          depthWrite={false}
        />
      </points>

      {/* núcleo */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.16, 32, 32]} />
        <meshBasicMaterial color={config.secondary} />
      </mesh>

      <mesh>
        <sphereGeometry args={[0.32, 32, 32]} />
        <meshBasicMaterial
          color={config.color}
          transparent
          opacity={0.11 + config.glow * 0.12}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <mesh>
        <sphereGeometry args={[0.56, 32, 32]} />
        <meshBasicMaterial
          color={config.color}
          transparent
          opacity={0.03 + config.glow * 0.04}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

export default function Orb3D({
  speakingLevel = 0.06,
  mode = "idle",
}: Orb3DProps) {
  const config = getModeConfig(mode);

  return (
    <div className={`orb3dWrap mode-${mode}`}>
      <Canvas
        camera={{ position: [0, 0.05, 5.45], fov: 35 }}
        gl={{ alpha: true, antialias: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.65} />
        <directionalLight
          position={[3, 3, 3]}
          intensity={1}
          color="#c4fbff"
        />
        <pointLight
          position={[0, 0.4, 2.6]}
          intensity={mode === "speaking" ? 2.2 : 1.75}
          color={config.color}
        />
        <pointLight
          position={[0, -1.4, 1.2]}
          intensity={0.75}
          color="#5acfff"
        />

        <Float speed={1.0} rotationIntensity={0.05} floatIntensity={0.08}>
          <GeoCore speakingLevel={speakingLevel} mode={mode} />
        </Float>
      </Canvas>

      <div className="voiceHalo">
        <span />
        <span />
        <span />
      </div>

      <div className="orbOverlay">
        <p>{config.label}</p>
        <strong>ORION</strong>
      </div>

      <style jsx>{`
        .orb3dWrap {
          position: relative;
          width: 100%;
          height: 100%;
          min-height: 100%;
        }

        .voiceHalo {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
        }

        .voiceHalo span {
          position: absolute;
          width: 270px;
          height: 270px;
          border-radius: 999px;
          border: 1px solid rgba(99, 236, 255, 0.12);
          opacity: 0;
        }

        .mode-listening .voiceHalo span,
        .mode-speaking .voiceHalo span,
        .mode-processing .voiceHalo span {
          animation: haloPulse 2.2s ease-out infinite;
        }

        .mode-speaking .voiceHalo span {
          border-color: rgba(99, 236, 255, 0.24);
        }

        .mode-listening .voiceHalo span {
          border-color: rgba(86, 255, 208, 0.2);
        }

        .mode-processing .voiceHalo span {
          border-color: rgba(141, 125, 255, 0.2);
        }

        .voiceHalo span:nth-child(2) {
          animation-delay: 0.45s;
        }

        .voiceHalo span:nth-child(3) {
          animation-delay: 0.9s;
        }

        .orbOverlay {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, 102px);
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
          font-weight: 800;
          letter-spacing: 0.28em;
        }

        .mode-listening .orbOverlay p {
          color: rgba(134, 255, 220, 0.82);
        }

        .mode-processing .orbOverlay p {
          color: rgba(190, 180, 255, 0.82);
        }

        .mode-speaking .orbOverlay p {
          color: rgba(220, 250, 255, 0.9);
        }

        .orbOverlay strong {
          color: #eafcff;
          font-size: 34px;
          font-weight: 900;
          letter-spacing: 0.28em;
          text-shadow: 0 0 24px rgba(97, 239, 255, 0.16);
        }

        @keyframes haloPulse {
          0% {
            transform: scale(0.72);
            opacity: 0;
          }
          35% {
            opacity: 0.45;
          }
          100% {
            transform: scale(1.28);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}