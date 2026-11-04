import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import { OrthographicCamera, Vector3, type Mesh } from 'three';
import { createElephant } from '../lib/elephant';
import type { ElephantHandle, ElephantPose, ElephantVerdict } from '../lib/elephant';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { useLang } from '../lib/i18n';
import { MascotFallback } from './MascotFallback';

/**
 * A stable isometric viewing direction. The mascot faces +z, so the camera
 * sits in front and to the right, high enough to read the hat and the coat.
 */
const CAMERA_DIRECTION = new Vector3(0.68, 0.72, 0.9).normalize();
const UP = new Vector3(0, 1, 0);

interface SceneProps {
  elephant: ElephantHandle;
  pose: ElephantPose;
  jumpHeight: number;
  reducedMotion: boolean;
}

function ElephantScene({
  elephant,
  pose,
  jumpHeight,
  reducedMotion,
}: SceneProps): ReactElement {
  useFrame((state) => {
    elephant.animate(state.clock.elapsedTime, pose, jumpHeight, reducedMotion);
  });

  return <primitive object={elephant.group} />;
}

/**
 * Frames the whole elephant inside the part of the stage that is not covered
 * by the top label or the bottom caption. The camera is orthographic so the
 * isometric read stays stable from phone to desktop.
 */
function CameraRig({
  elephant,
  scale,
  jumpHeight,
}: {
  elephant: ElephantHandle;
  scale: number;
  jumpHeight: number;
}): null {
  const camera = useThree((state) => state.camera) as OrthographicCamera;
  const size = useThree((state) => state.size);

  useLayoutEffect(() => {
    const group = elephant.group;
    const restingY = group.position.y;
    group.position.y = 0;
    group.scale.setScalar(scale);
    group.updateMatrixWorld(true);

    // Fit the real boxes, not one empty bounding box around the whole model.
    const corners: Vector3[] = [];
    group.traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      const bounds = mesh.geometry.boundingBox;
      if (!bounds) return;
      for (const x of [bounds.min.x, bounds.max.x]) {
        for (const y of [bounds.min.y, bounds.max.y]) {
          for (const z of [bounds.min.z, bounds.max.z]) {
            corners.push(new Vector3(x, y, z).applyMatrix4(mesh.matrixWorld));
          }
        }
      }
    });

    group.position.y = restingY;

    const center = new Vector3();
    for (const corner of corners) center.add(corner);
    center.multiplyScalar(1 / Math.max(1, corners.length));

    const topInset = (size.height < 460 ? 36 : 44) + Math.min(36, jumpHeight * 60);
    const bottomInset = size.height < 460 ? 146 : 132;
    const aspect = size.width / Math.max(1, size.height);
    const topLimit = 1 - (2 * topInset) / size.height;
    const bottomLimit = -1 + (2 * bottomInset) / size.height;
    const sideLimit = 0.86;
    const centerLimit = (topLimit + bottomLimit) / 2;
    const target = new Vector3();

    const fit = (zoom: number): void => {
      // Shift the target so the model center lands on the visible band
      // between the top label and the bottom caption.
      target.copy(center).addScaledVector(UP, -centerLimit / zoom);
      camera.position.copy(target).addScaledVector(CAMERA_DIRECTION, 20);
      camera.up.copy(UP);
      camera.lookAt(target);
      camera.left = -aspect;
      camera.right = aspect;
      camera.top = 1;
      camera.bottom = -1;
      camera.near = 0.1;
      camera.far = 100;
      camera.zoom = zoom;
      camera.updateMatrixWorld();
      camera.updateProjectionMatrix();
    };

    let low = 0.01;
    let high = 240;
    for (let index = 0; index < 32; index += 1) {
      const mid = (low + high) / 2;
      fit(mid);
      const fits = corners.every((corner) => {
        const point = corner.clone().project(camera);
        return (
          point.x >= -sideLimit &&
          point.x <= sideLimit &&
          point.y >= bottomLimit &&
          point.y <= topLimit
        );
      });
      if (fits) low = mid;
      else high = mid;
    }

    fit(low);
  }, [camera, elephant, scale, size.height, size.width, jumpHeight]);

  return null;
}

export interface ElephantMascotProps {
  pose?: ElephantPose;
  verdict?: ElephantVerdict;
  scale?: number;
  jumpHeight?: number;
  className?: string;
  label?: string;
}

/**
 * Reusable voxel detective elephant. The figure is built from boxes only,
 * faces +z, and is framed by an orthographic isometric camera. The drawing is
 * decorative; the wrapper carries the text label.
 */
export function ElephantMascot({
  pose = 'idle',
  verdict,
  scale = 0.34,
  jumpHeight = 0,
  className,
  label,
}: ElephantMascotProps): ReactElement {
  const reducedMotion = usePrefersReducedMotion();
  const { tx } = useLang();
  const elephant = useMemo(() => createElephant(), []);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [onScreen, setOnScreen] = useState(true);

  useEffect(() => {
    const element = wrapperRef.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) setOnScreen(entry.isIntersecting);
      },
      { rootMargin: '120px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => () => elephant.dispose(), [elephant]);

  useLayoutEffect(() => {
    elephant.setVerdict(verdict);
  }, [elephant, verdict]);

  const accessibleLabel =
    label ??
    tx(
      'Voxel detective elephant on duty',
      'Gajah detektif voxel sedang bertugas',
    );

  if (reducedMotion) {
    return <MascotFallback label={accessibleLabel} className={className} />;
  }

  return (
    <div
      ref={wrapperRef}
      className={`mascot-canvas ${className ?? ''}`.trim()}
      role="img"
      aria-label={accessibleLabel}
    >
      <Canvas
        aria-hidden="true"
        orthographic
        dpr={[1, 2]}
        shadows
        camera={{ position: [8, 8, 8], zoom: 1, near: 0.1, far: 100 }}
        frameloop={onScreen ? 'always' : 'never'}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      >
        <ambientLight intensity={0.85} />
        <hemisphereLight args={['#e3e9ff', '#191735', 0.8]} />
        <directionalLight
          position={[6, 10, 7]}
          intensity={1.7}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-8}
          shadow-camera-right={8}
          shadow-camera-top={10}
          shadow-camera-bottom={-6}
        />
        <pointLight position={[-6, 5, 4]} intensity={0.5} color="#9ff3ff" />
        <CameraRig elephant={elephant} scale={scale} jumpHeight={jumpHeight} />
        <ElephantScene
          elephant={elephant}
          pose={pose}
          jumpHeight={jumpHeight}
          reducedMotion={reducedMotion}
        />
        <ContactShadows
          position={[0, 0.01, 0]}
          opacity={0.48}
          scale={18}
          blur={2.6}
          far={10}
          resolution={512}
          color="#080618"
        />
      </Canvas>
    </div>
  );
}
