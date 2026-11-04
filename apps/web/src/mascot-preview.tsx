import React, { useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { createElephant, type ElephantHandle } from './lib/elephant';

function Scene({ lookAt }: { lookAt: [number, number, number] }): React.ReactElement {
  const elephant = useMemo<ElephantHandle>(() => createElephant(), []);
  const { camera } = useThree();
  React.useLayoutEffect(() => {
    camera.lookAt(lookAt[0], lookAt[1], lookAt[2]);
    camera.updateProjectionMatrix();
  }, [camera, lookAt]);
  useFrame((state) => elephant.animate(state.clock.elapsedTime, 'scan'));
  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight position={[6, 10, 7]} intensity={1.8} />
      <directionalLight position={[-8, 6, 4]} intensity={0.6} />
      <primitive object={elephant.group} />
    </>
  );
}

function App(): React.ReactElement {
  const views: Array<{ label: string; position: [number, number, number]; lookAt: [number, number, number] }> = [
    { label: 'front', position: [0, 8, 42], lookAt: [0, 8, 0] },
    { label: 'isometric', position: [24, 19, 28], lookAt: [0, 7, 0] },
    { label: 'side', position: [42, 8, 0], lookAt: [0, 8, 0] },
    { label: 'three-quarter', position: [-24, 18, 30], lookAt: [0, 7, 0] },
  ];
  return (
    <>
      {views.map((view) => (
        <div className="cell" key={view.label}>
          <span>{view.label}</span>
          <Canvas
            dpr={[1, 2]}
            camera={{ position: view.position, fov: 30, near: 0.1, far: 200 }}
            gl={{ antialias: true, alpha: true }}
          >
            <Scene lookAt={view.lookAt} />
          </Canvas>
        </div>
      ))}
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
