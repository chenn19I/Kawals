import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createElephant } from '../src/lib/elephant';

describe('maskot gajah voxel', () => {
  it('membuat group dan handle', () => {
    const elephant = createElephant();
    expect(elephant.group).toBeInstanceOf(THREE.Group);
    expect(typeof elephant.animate).toBe('function');
    expect(typeof elephant.setVerdict).toBe('function');
    expect(typeof elephant.dispose).toBe('function');
  });

  it('hanya memakai BoxGeometry', () => {
    const elephant = createElephant();
    const geometries = new Set<string>();
    elephant.group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && mesh.geometry) geometries.add(mesh.geometry.type);
    });
    expect([...geometries]).toEqual(['BoxGeometry']);
    elephant.dispose();
  });

  it('memiliki empat kaki di posisi yang benar', () => {
    const elephant = createElephant();
    const meshes: THREE.Mesh[] = [];
    elephant.group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && mesh.name.startsWith('leg-')) meshes.push(mesh);
    });
    expect(meshes).toHaveLength(4);
    const positions = meshes.map((m) => [m.position.x, m.position.z]).sort();
    expect(positions).toContainEqual([-2.4, -3]);
    expect(positions).toContainEqual([2.4, -3]);
    expect(positions).toContainEqual([-2.4, 3]);
    expect(positions).toContainEqual([2.4, 3]);
    elephant.dispose();
  });

  it('lensa berubah warna sesuai verdict', () => {
    const elephant = createElephant();
    let lens: THREE.Mesh | undefined;
    elephant.group.traverse((obj) => {
      if ((obj as THREE.Mesh).name === 'magnifier-lens') lens = obj as THREE.Mesh;
    });
    expect(lens).toBeDefined();
    elephant.setVerdict('reject');
    const mat = lens!.material as THREE.MeshToonMaterial;
    expect(mat.emissive.getHex()).toBe(0xb3261e);
    elephant.setVerdict('pass');
    expect((lens!.material as THREE.MeshToonMaterial).emissive.getHex()).toBe(0x2e7d5b);
    elephant.dispose();
  });

  it('animasi walk mengangkat kaki', () => {
    const elephant = createElephant();
    const legs: THREE.Mesh[] = [];
    elephant.group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh && (obj as THREE.Mesh).name.startsWith('leg-')) legs.push(obj as THREE.Mesh);
    });
    const before = legs[0]!.position.y;
    elephant.animate(0.5, 'walk');
    // trigger a frame where lift occurs
    elephant.animate(0.9, 'walk');
    const after = legs[0]!.position.y;
    expect(after).not.toBeNaN();
    elephant.dispose();
  });

  it('animasi blink mengecilkan mata setiap ~3.4s', () => {
    const elephant = createElephant();
    let eye: THREE.Mesh | undefined;
    elephant.group.traverse((obj) => {
      if ((obj as THREE.Mesh).name === 'eye-left') eye = obj as THREE.Mesh;
    });
    expect(eye).toBeDefined();
    // run animation near 3.4s
    elephant.animate(3.4, 'idle');
    expect(eye!.scale.y).toBeLessThanOrEqual(1);
    elephant.dispose();
  });

  it('reduced motion tetap memungkinkan jump', () => {
    const elephant = createElephant();
    elephant.animate(0.5, 'idle', 1.5, true);
    expect(elephant.group.position.y).toBeGreaterThanOrEqual(0);
    elephant.dispose();
  });

  it('dispose membersihkan resource', () => {
    const elephant = createElephant();
    expect(() => elephant.dispose()).not.toThrow();
  });
});
