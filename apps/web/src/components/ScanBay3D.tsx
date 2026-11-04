import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { MathUtils, OrthographicCamera, type Group, type Mesh, type MeshStandardMaterial } from 'three';
import type { Decision } from '@kawal/rules';

export type Scan3DPhase = 'idle' | 'scanning' | 'verdict' | 'error';

const TONE: Record<Decision, string> = {
  LOLOS: '#4fbf8b',
  TAHAN: '#ff8a4d',
  TOLAK: '#ff6a63',
};

const IDLE_LAMP = '#8ba0ff';
const BELT_SPEED = 0.55;
const TRAVEL_SECONDS = 2.35;

function easeInOut(value: number): number {
  return value < 0.5 ? 2 * value * value : 1 - (-2 * value + 2) ** 2 / 2;
}

/**
 * The orthographic camera keeps the airport diorama stable at every viewport
 * size. One unit is about 1/4.7 of the canvas height, so the whole belt, arch,
 * and case always fit without a resize jump.
 */
function CameraRig(): null {
  const camera = useThree((state) => state.camera) as OrthographicCamera;
  const size = useThree((state) => state.size);

  useLayoutEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    const halfHeight = 2.35;
    camera.left = -halfHeight * aspect;
    camera.right = halfHeight * aspect;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.position.set(5.9, 4.35, 7.4);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0.9, 0);
    camera.near = 0.1;
    camera.far = 60;
    camera.updateProjectionMatrix();
  }, [camera, size.height, size.width]);

  return null;
}

function ConveyorBelt({ scanning }: { scanning: boolean }): ReactElement {
  const slats = useRef<Group | null>(null);
  const travel = useRef(0);

  const slatPositions = useMemo(
    () => Array.from({ length: 20 }, (_, index) => -4.35 + index * 0.46),
    [],
  );

  useFrame((_, delta) => {
    if (!slats.current) return;
    if (scanning) travel.current = (travel.current + delta * BELT_SPEED) % 0.46;
    slats.current.position.x = scanning ? -travel.current : 0;
  });

  return (
    <group>
      <mesh position={[0, 0.3, 0]} receiveShadow>
        <boxGeometry args={[8.9, 0.28, 1.5]} />
        <meshStandardMaterial color="#232b31" roughness={0.86} metalness={0.18} />
      </mesh>

      <mesh position={[0, 0.455, 0]} receiveShadow>
        <boxGeometry args={[8.9, 0.05, 1.38]} />
        <meshStandardMaterial color="#303a41" roughness={0.72} metalness={0.28} />
      </mesh>

      <group ref={slats} position={[0, 0.49, 0]}>
        {slatPositions.map((x) => (
          <mesh key={x} position={[x, 0, 0]}>
            <boxGeometry args={[0.05, 0.018, 1.3]} />
            <meshStandardMaterial
              color="#56636b"
              emissive="#1b3ff0"
              emissiveIntensity={0.1}
              roughness={0.6}
            />
          </mesh>
        ))}
      </group>

      {[-3.25, -1.1, 1.1, 3.25].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.08, 0.55]} castShadow>
            <boxGeometry args={[0.14, 0.3, 0.14]} />
            <meshStandardMaterial color="#151b20" roughness={0.8} />
          </mesh>
          <mesh position={[x, 0.08, -0.55]} castShadow>
            <boxGeometry args={[0.14, 0.3, 0.14]} />
            <meshStandardMaterial color="#151b20" roughness={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function ScannerArch({
  scanning,
  verdict,
}: {
  scanning: boolean;
  verdict: Decision | null;
}): ReactElement {
  const beam = useRef<Mesh | null>(null);
  const lamp = useRef<MeshStandardMaterial | null>(null);
  const glow = useRef<MeshStandardMaterial | null>(null);
  const head = useRef<Mesh | null>(null);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    const tone = verdict ? TONE[verdict] : IDLE_LAMP;

    if (beam.current) {
      beam.current.visible = scanning;
      if (scanning) {
        beam.current.position.x = Math.sin(time * 2.3) * 0.38;
        const material = beam.current.material as MeshStandardMaterial;
        material.opacity = 0.3 + Math.abs(Math.sin(time * 4.6)) * 0.34;
        material.emissiveIntensity = 1.3 + Math.abs(Math.sin(time * 4.6)) * 1.1;
      }
    }

    if (lamp.current) {
      lamp.current.color.set(tone);
      lamp.current.emissive.set(tone);
      lamp.current.emissiveIntensity = scanning
        ? 1.1 + Math.abs(Math.sin(time * 5.2)) * 1.4
        : verdict
          ? 1.6
          : 0.5;
    }

    if (glow.current) {
      glow.current.color.set(tone);
      glow.current.emissive.set(tone);
      glow.current.opacity = scanning ? 0.16 + Math.abs(Math.sin(time * 3.1)) * 0.1 : 0.08;
    }

    if (head.current) {
      head.current.position.y = 2.47 + (scanning ? Math.sin(time * 5.2) * 0.018 : 0);
    }
  });

  return (
    <group>
      {/* Two uprights and a crossbar make the familiar airport arch. */}
      {[-0.88, 0.88].map((z) => (
        <group key={z}>
          <mesh position={[0, 1.58, z]} castShadow>
            <boxGeometry args={[0.18, 2.5, 0.18]} />
            <meshStandardMaterial color="#5b6770" roughness={0.38} metalness={0.5} />
          </mesh>
          <mesh position={[0, 1.58, z + (z > 0 ? 0.095 : -0.095)]}>
            <boxGeometry args={[0.045, 2.24, 0.02]} />
            <meshStandardMaterial
              color="#8ba0ff"
              emissive="#1b3ff0"
              emissiveIntensity={0.6}
              roughness={0.3}
            />
          </mesh>
        </group>
      ))}

      <mesh position={[0, 2.84, 0]} castShadow>
        <boxGeometry args={[0.26, 0.26, 2.04]} />
        <meshStandardMaterial color="#5b6770" roughness={0.38} metalness={0.5} />
      </mesh>

      <mesh ref={head} position={[0, 2.47, 0]} castShadow>
        <boxGeometry args={[0.34, 0.36, 0.78]} />
        <meshStandardMaterial color="#121821" roughness={0.32} metalness={0.55} />
      </mesh>

      <mesh position={[0, 2.47, 0]} rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[0.08, 0.02, 0.62]} />
        <meshStandardMaterial
          ref={lamp}
          color={IDLE_LAMP}
          emissive={IDLE_LAMP}
          emissiveIntensity={0.5}
          toneMapped={false}
        />
      </mesh>

      {/* A faint x-ray curtain fills the arch. */}
      <mesh position={[0, 1.6, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[1.68, 2.32]} />
        <meshStandardMaterial
          ref={glow}
          color={IDLE_LAMP}
          emissive={IDLE_LAMP}
          transparent
          opacity={0.08}
          side={2}
          depthWrite={false}
        />
      </mesh>

      {/* Thin moving sheet of light: the read itself. */}
      <mesh ref={beam} position={[0, 1.58, 0]} visible={false}>
        <boxGeometry args={[0.035, 2.2, 1.5]} />
        <meshStandardMaterial
          color="#b7c6ff"
          emissive="#5b78ff"
          emissiveIntensity={1.5}
          transparent
          opacity={0.5}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <pointLight position={[0, 2.2, 0]} intensity={scanning ? 5 : 1.5} color={IDLE_LAMP} distance={4.2} />
    </group>
  );
}

function Suitcase({
  phase,
  verdict,
}: {
  phase: Scan3DPhase;
  verdict: Decision | null;
}): ReactElement {
  const group = useRef<Group | null>(null);
  const outline = useRef<Mesh | null>(null);
  const progress = useRef(0);
  const scanning = phase === 'scanning';

  useEffect(() => {
    progress.current = 0;
  }, [phase]);

  useFrame((state, delta) => {
    if (!group.current) return;
    if (scanning) progress.current = Math.min(1, progress.current + delta / TRAVEL_SECONDS);
    const eased = easeInOut(progress.current);
    const targetX = scanning ? -3.05 + 3.3 * eased : phase === 'verdict' ? 0.25 : -3.05;
    const shake = phase === 'error' ? Math.sin(state.clock.elapsedTime * 42) * 0.035 : 0;
    group.current.position.x = MathUtils.damp(group.current.position.x, targetX + shake, 8, delta);
    group.current.rotation.z =
      phase === 'error' ? Math.sin(state.clock.elapsedTime * 36) * 0.025 : 0;

    if (outline.current) {
      outline.current.visible = scanning;
      const material = outline.current.material as MeshStandardMaterial;
      material.opacity = 0.2 + Math.abs(Math.sin(state.clock.elapsedTime * 3.7)) * 0.28;
    }
  });

  return (
    <group ref={group} position={[-3.05, 0.49, 0]}>
      <mesh position={[0, 0.46, 0]} castShadow>
        <boxGeometry args={[1.32, 0.88, 0.56]} />
        <meshStandardMaterial
          color="#31424d"
          roughness={0.52}
          metalness={0.22}
          emissive={scanning ? '#1b3ff0' : '#000000'}
          emissiveIntensity={scanning ? 0.12 : 0}
        />
      </mesh>

      {/* Front straps and a paper tag read as luggage, not a generic box. */}
      {[-0.38, 0.38].map((x) => (
        <mesh key={x} position={[x, 0.46, 0.289]}>
          <boxGeometry args={[0.13, 0.9, 0.02]} />
          <meshStandardMaterial color="#c9b79a" roughness={0.82} />
        </mesh>
      ))}

      <mesh position={[0.47, 0.74, 0.3]} rotation={[0, 0, -0.08]}>
        <boxGeometry args={[0.2, 0.13, 0.02]} />
        <meshStandardMaterial
          color="#e7e2d5"
          emissive={verdict ? TONE[verdict] : '#000000'}
          emissiveIntensity={verdict ? 0.22 : 0}
          roughness={0.9}
        />
      </mesh>

      {/* Handle */}
      <mesh position={[0, 0.96, 0]}>
        <boxGeometry args={[0.5, 0.06, 0.1]} />
        <meshStandardMaterial color="#1b2228" roughness={0.5} metalness={0.3} />
      </mesh>
      {[-0.22, 0.22].map((x) => (
        <mesh key={x} position={[x, 0.9, 0]}>
          <boxGeometry args={[0.06, 0.12, 0.07]} />
          <meshStandardMaterial color="#1b2228" roughness={0.5} metalness={0.3} />
        </mesh>
      ))}

      {/* Wheels */}
      {[-0.47, 0.47].map((x) => (
        <mesh key={x} position={[x, 0.055, 0.22]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.09, 0.09, 0.07, 14]} />
          <meshStandardMaterial color="#10161a" roughness={0.7} />
        </mesh>
      ))}

      {/* X-ray outline around the case while the scanner reads it. */}
      <mesh ref={outline} position={[0, 0.46, 0]} visible={false}>
        <boxGeometry args={[1.4, 0.96, 0.64]} />
        <meshStandardMaterial
          color="#8ba0ff"
          emissive="#8ba0ff"
          emissiveIntensity={0.8}
          wireframe
          transparent
          opacity={0.3}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

/**
 * The demo scanner: a box-built airport belt, arch, and suitcase. The CSS
 * version in ScanBay stays as the reduced-motion and pre-load fallback, so the
 * three-dimensional layer is decorative and never the only source of status.
 */
export function ScanBay3D({
  phase,
  verdict,
}: {
  phase: Scan3DPhase;
  verdict: Decision | null;
}): ReactElement {
  const wrapper = useRef<HTMLDivElement | null>(null);
  const [onScreen, setOnScreen] = useState(true);
  const scanning = phase === 'scanning';

  useEffect(() => {
    const element = wrapper.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) setOnScreen(entry.isIntersecting);
      },
      { rootMargin: '80px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="scan-bay__canvas" ref={wrapper} aria-hidden="true">
      <Canvas
        orthographic
        dpr={[1, 2]}
        shadows
        camera={{ position: [5.9, 4.35, 7.4], zoom: 1, near: 0.1, far: 60 }}
        frameloop={onScreen ? 'always' : 'never'}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      >
        <CameraRig />
        <ambientLight intensity={0.75} />
        <hemisphereLight args={['#dfe6ff', '#10121f', 0.9]} />
        <directionalLight
          position={[4, 8, 6]}
          intensity={2}
          castShadow
          shadow-mapSize={[512, 512]}
          shadow-camera-left={-6}
          shadow-camera-right={6}
          shadow-camera-top={6}
          shadow-camera-bottom={-4}
        />
        <pointLight position={[-4, 2.5, 3]} intensity={0.7} color="#9ff3ff" />
        <pointLight position={[4, 1.8, -3]} intensity={0.35} color="#ff9a62" />

        <ConveyorBelt scanning={scanning} />
        <ScannerArch scanning={scanning} verdict={verdict} />
        <Suitcase phase={phase} verdict={verdict} />

        {/* A dark slab grounds the diorama without hiding the CSS grid behind. */}
        <mesh position={[0, -0.3, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[14, 7]} />
          <meshStandardMaterial color="#0b0d17" roughness={0.95} transparent opacity={0.82} />
        </mesh>
      </Canvas>
    </div>
  );
}
