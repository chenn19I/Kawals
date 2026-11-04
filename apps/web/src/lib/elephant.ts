import * as THREE from 'three';

export type ElephantPose = 'idle' | 'walk' | 'scan' | 'celebrate';
export type ElephantVerdict = 'pass' | 'hold' | 'reject';

const COLORS = {
  skin: 0x9fb0d8,
  skinDark: 0x7f90c4,
  pink: 0xe7a3b5,
  eye: 0x14122b,
  white: 0xfff4d6,
  coat: 0xc8a05a,
  coatHem: 0xa8803f,
  scarf: 0xe0402f,
  hatBrim: 0xd1a45c,
  hatCrown: 0xd1a45c,
  hatBand: 0x8a6431,
  handle: 0x5a3d22,
  gold: 0xffcf5a,
  cyan: 0x9ff3ff,
  tuft: 0x5a3d22,
} as const;

const VERDICT_COLORS: Record<ElephantVerdict, number> = {
  pass: 0x2e7d5b,
  hold: 0xf2551d,
  reject: 0xb3261e,
};

// Five steps of cel shading. Nearest sampling keeps the bands crisp.
function createToonGradient(): THREE.DataTexture {
  const colors = new Uint8Array([40, 80, 130, 190, 255]);
  const texture = new THREE.DataTexture(colors, colors.length, 1, THREE.RedFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

const gradient = createToonGradient();

function toonMaterial(
  color: number,
  opts?: { transparent?: boolean; opacity?: number; emissive?: boolean },
): THREE.MeshToonMaterial {
  const mat = new THREE.MeshToonMaterial({
    color,
    gradientMap: gradient,
    transparent: opts?.transparent ?? false,
    opacity: opts?.opacity ?? 1,
  });
  if (opts?.emissive) {
    mat.emissive = new THREE.Color(color);
    mat.emissiveIntensity = 0.8;
  }
  return mat;
}

function box(
  w: number,
  h: number,
  d: number,
  color: number,
  opts?: { transparent?: boolean; opacity?: number; emissive?: boolean },
): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = toonMaterial(color, opts);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function addOutline(mesh: THREE.Mesh): void {
  const edges = new THREE.EdgesGeometry(mesh.geometry);
  const line = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({ color: 0x080618, transparent: true, opacity: 0.55 }),
  );
  mesh.add(line);
}

function part(mesh: THREE.Mesh, name: string): THREE.Mesh {
  mesh.name = name;
  mesh.userData.part = name;
  addOutline(mesh);
  return mesh;
}

interface LegState {
  mesh: THREE.Mesh;
  baseX: number;
  baseY: number;
  baseZ: number;
  phase: number;
}

export interface ElephantHandle {
  group: THREE.Group;
  animate: (time: number, pose: ElephantPose, jumpHeight?: number, reducedMotion?: boolean) => void;
  setVerdict: (verdict?: ElephantVerdict) => void;
  dispose: () => void;
}

const HEAD_PIVOT_Y = 9;
const HEAD_PIVOT_Z = 3;
const TRUNK_BASE_X = 0;
const TRUNK_BASE_Y = 0.45;
const TRUNK_BASE_Z = 3.25;
const MAG_BASE_X = 0;
const MAG_BASE_Y = -4.7;
const MAG_BASE_Z = 1.75;

export function createElephant(): ElephantHandle {
  const root = new THREE.Group();
  root.name = 'elephant';

  const bodyGroup = new THREE.Group();
  bodyGroup.name = 'body';
  const headGroup = new THREE.Group();
  headGroup.name = 'head';
  headGroup.position.set(0, HEAD_PIVOT_Y, HEAD_PIVOT_Z);
  const trunkGroup = new THREE.Group();
  trunkGroup.name = 'trunk';
  trunkGroup.position.set(TRUNK_BASE_X, TRUNK_BASE_Y, TRUNK_BASE_Z);
  const scarfTailGroup = new THREE.Group();
  scarfTailGroup.name = 'scarfTail';
  const magnifierGroup = new THREE.Group();
  magnifierGroup.name = 'magnifier';

  // Four short legs. The exact x/z anchors are part of the mascot contract.
  const legPositions: Array<[number, number, number]> = [
    [-2.4, -3, 0],
    [2.4, -3, Math.PI],
    [-2.4, 3, Math.PI],
    [2.4, 3, 0],
  ];
  const legs: LegState[] = legPositions.map(([x, z, phase], index) => {
    const mesh = part(box(2.2, 3, 2.2, COLORS.skinDark), `leg-${index}`);
    mesh.position.set(x, 1.5, z);
    bodyGroup.add(mesh);
    return { mesh, baseX: x, baseY: 1.5, baseZ: z, phase };
  });

  // Tail, behind the coat.
  const tail = part(box(0.7, 2.4, 0.7, COLORS.skinDark), 'tail');
  tail.position.set(0, 6.6, -4.15);
  bodyGroup.add(tail);
  const tuft = part(box(1.1, 0.7, 1.1, COLORS.tuft), 'tail-tuft');
  tuft.position.set(0, 5.2, -4.15);
  bodyGroup.add(tuft);

  // Long coat with a darker hem, a center seam, and brass buttons.
  const coat = part(box(7, 5.4, 7, COLORS.coat), 'coat');
  coat.position.set(0, 5.9, 0);
  bodyGroup.add(coat);

  const hem = part(box(7.3, 0.9, 7.3, COLORS.coatHem), 'coatHem');
  hem.position.set(0, 3.15, 0);
  bodyGroup.add(hem);

  const seam = part(box(0.32, 4.4, 0.22, COLORS.coatHem), 'coat-seam');
  seam.position.set(0, 6.1, 3.55);
  bodyGroup.add(seam);

  for (const [index, x] of [-1.25, 1.25].entries()) {
    for (const [row, y] of [6.8, 5.4].entries()) {
      const button = part(box(0.46, 0.46, 0.26, COLORS.gold), `button-${index}-${row}`);
      button.position.set(x, y, 3.58);
      bodyGroup.add(button);
    }
  }

  // Scarf around the neck, with a knot and a loose end on the right.
  const scarf = part(box(6.8, 1.1, 1.5, COLORS.scarf), 'scarf');
  scarf.position.set(0, 8.35, 3.4);
  bodyGroup.add(scarf);

  scarfTailGroup.position.set(2.75, 8.15, 3.75);
  const knot = part(box(1.15, 1.15, 0.75, COLORS.scarf), 'scarf-knot');
  scarfTailGroup.add(knot);
  const looseEnd = part(box(0.95, 2.7, 0.55, COLORS.scarf), 'scarfTail');
  looseEnd.position.set(0.3, -1.55, 0);
  looseEnd.rotation.z = -0.08;
  scarfTailGroup.add(looseEnd);
  bodyGroup.add(scarfTailGroup);

  // Head and neck. The head overlaps the coat so the two boxes read as one body.
  const neck = part(box(3.6, 1.6, 3.2, COLORS.skin), 'neck');
  neck.position.set(0, 8.7, 3.1);
  bodyGroup.add(neck);

  const head = part(box(6.4, 5.4, 5.2, COLORS.skin), 'head');
  head.position.set(0, 2, 1);
  headGroup.add(head);

  // Big ears with pink inner faces, angled slightly back.
  const leftEar = part(box(1.2, 4.6, 4, COLORS.skinDark), 'ear-left');
  leftEar.position.set(-3.8, 2, 1.2);
  leftEar.rotation.y = 0.06;
  headGroup.add(leftEar);
  const leftEarInner = part(box(0.22, 3.4, 3, COLORS.pink), 'ear-inner-left');
  leftEarInner.position.set(-4.42, 2, 1.2);
  leftEarInner.rotation.y = 0.06;
  headGroup.add(leftEarInner);

  const rightEar = part(box(1.2, 4.6, 4, COLORS.skinDark), 'ear-right');
  rightEar.position.set(3.8, 2, 1.2);
  rightEar.rotation.y = -0.06;
  headGroup.add(rightEar);
  const rightEarInner = part(box(0.22, 3.4, 3, COLORS.pink), 'ear-inner-right');
  rightEarInner.position.set(4.42, 2, 1.2);
  rightEarInner.rotation.y = -0.06;
  headGroup.add(rightEarInner);

  // Eyes sit just proud of the face so the outline stays clean.
  const leftEye = part(box(0.9, 1, 0.3, COLORS.eye), 'eye-left');
  leftEye.position.set(-1.35, 2.55, 3.62);
  headGroup.add(leftEye);
  const leftHighlight = part(box(0.28, 0.28, 0.2, COLORS.cyan), 'eye-highlight-left');
  leftHighlight.position.set(-1.2, 2.76, 3.82);
  headGroup.add(leftHighlight);

  const rightEye = part(box(0.9, 1, 0.3, COLORS.eye), 'eye-right');
  rightEye.position.set(1.35, 2.55, 3.62);
  headGroup.add(rightEye);
  const rightHighlight = part(box(0.28, 0.28, 0.2, COLORS.cyan), 'eye-highlight-right');
  rightHighlight.position.set(1.5, 2.76, 3.82);
  headGroup.add(rightHighlight);

  // Two small tusks flanking the trunk.
  const leftTusk = part(box(0.55, 0.55, 1.4, COLORS.white), 'tusk-left');
  leftTusk.position.set(-1, 0.15, 4.45);
  headGroup.add(leftTusk);
  const rightTusk = part(box(0.55, 0.55, 1.4, COLORS.white), 'tusk-right');
  rightTusk.position.set(1, 0.15, 4.45);
  headGroup.add(rightTusk);

  // Three stacked trunk blocks with a slight forward curl.
  const trunkUpper = part(box(1.5, 2, 1.5, COLORS.skin), 'trunk-upper');
  trunkUpper.position.set(0, -1, 0.25);
  trunkGroup.add(trunkUpper);
  const trunkMid = part(box(1.4, 1.8, 1.4, COLORS.skin), 'trunk-mid');
  trunkMid.position.set(0, -2.6, 0.7);
  trunkGroup.add(trunkMid);
  const trunkTip = part(box(1.2, 1.5, 1.2, COLORS.skin), 'trunk-tip');
  trunkTip.position.set(0, -3.95, 1.2);
  trunkGroup.add(trunkTip);

  // A small gold-rimmed magnifier held at the trunk tip.
  const handle = part(box(0.55, 1.8, 0.55, COLORS.handle), 'magnifier-handle');
  handle.position.set(0, 2.3, 0);
  magnifierGroup.add(handle);

  const frameTop = part(box(3.2, 0.4, 0.4, COLORS.gold), 'magnifier-frame-top');
  frameTop.position.set(0, 1.6, 0);
  magnifierGroup.add(frameTop);
  const frameBottom = part(box(3.2, 0.4, 0.4, COLORS.gold), 'magnifier-frame-bottom');
  frameBottom.position.set(0, -1.6, 0);
  magnifierGroup.add(frameBottom);
  const frameLeft = part(box(0.4, 3.2, 0.4, COLORS.gold), 'magnifier-frame-left');
  frameLeft.position.set(-1.6, 0, 0);
  magnifierGroup.add(frameLeft);
  const frameRight = part(box(0.4, 3.2, 0.4, COLORS.gold), 'magnifier-frame-right');
  frameRight.position.set(1.6, 0, 0);
  magnifierGroup.add(frameRight);

  const lensMat = toonMaterial(COLORS.cyan, { transparent: true, opacity: 0.38, emissive: true });
  const lensGeo = new THREE.BoxGeometry(2.4, 2.4, 0.24);
  const lens = new THREE.Mesh(lensGeo, lensMat);
  lens.name = 'magnifier-lens';
  lens.userData.part = 'magnifier-lens';
  addOutline(lens);
  magnifierGroup.add(lens);

  const lensLight = new THREE.PointLight(COLORS.cyan, 1.5, 5);
  lensLight.position.set(0, 0, 0.3);
  magnifierGroup.add(lensLight);

  magnifierGroup.position.set(MAG_BASE_X, MAG_BASE_Y, MAG_BASE_Z);
  magnifierGroup.rotation.set(0, -0.1, -0.2);
  trunkGroup.add(magnifierGroup);
  headGroup.add(trunkGroup);

  // Fedora: wide brim, taller crown, brown band, small gold badge.
  const hatBrim = part(box(7, 0.6, 6.8, COLORS.hatBrim), 'hat-brim');
  hatBrim.position.set(0, 4.95, 1);
  headGroup.add(hatBrim);
  const hatCrown = part(box(4.8, 1.9, 4.4, COLORS.hatCrown), 'hat-crown');
  hatCrown.position.set(0, 6.1, 1);
  headGroup.add(hatCrown);
  const hatBand = part(box(4.9, 0.45, 4.5, COLORS.hatBand), 'hat-band');
  hatBand.position.set(0, 5.55, 1);
  headGroup.add(hatBand);
  const hatBadge = part(box(0.7, 0.7, 0.22, COLORS.gold), 'hat-badge');
  hatBadge.position.set(0, 5.55, 3.28);
  headGroup.add(hatBadge);

  bodyGroup.add(headGroup);
  root.add(bodyGroup);

  const setVerdict = (verdict?: ElephantVerdict): void => {
    const color = verdict ? VERDICT_COLORS[verdict] : COLORS.cyan;
    lensMat.color.setHex(color);
    lensMat.emissive.setHex(color);
    lensLight.color.setHex(color);
  };

  const animate = (
    time: number,
    pose: ElephantPose,
    jumpHeight = 0,
    reducedMotion = false,
  ): void => {
    // Reset every animated transform so poses never leak into each other.
    root.position.set(0, 0, 0);
    root.rotation.z = 0;
    bodyGroup.scale.set(1, 1, 1);
    bodyGroup.position.y = 0;
    headGroup.position.set(0, HEAD_PIVOT_Y, HEAD_PIVOT_Z);
    headGroup.rotation.set(0, 0, 0);
    trunkGroup.position.set(TRUNK_BASE_X, TRUNK_BASE_Y, TRUNK_BASE_Z);
    trunkGroup.rotation.set(0, 0, 0);
    scarfTailGroup.rotation.set(0, 0, 0);
    tail.rotation.set(0, 0, 0);
    magnifierGroup.position.set(MAG_BASE_X, MAG_BASE_Y, MAG_BASE_Z);
    magnifierGroup.rotation.set(0, -0.1, -0.2);
    leftEar.rotation.set(0, 0.06, 0);
    rightEar.rotation.set(0, -0.06, 0);
    lensLight.intensity = 1.5;
    legs.forEach((leg) => {
      leg.mesh.position.set(leg.baseX, leg.baseY, leg.baseZ);
      leg.mesh.rotation.x = 0;
    });

    const jumpOffset = jumpHeight > 0 ? Math.abs(Math.sin(time * 5.4)) * jumpHeight : 0;

    if (reducedMotion) {
      root.position.y = jumpOffset;
      leftHighlight.visible = true;
      rightHighlight.visible = true;
      leftEye.scale.y = 1;
      rightEye.scale.y = 1;
      return;
    }

    // Blink on a real 3.4 second clock, not a frame counter.
    const blinkPhase = time % 3.4;
    const blinking = blinkPhase > 3.24;
    leftEye.scale.y = blinking ? 0.12 : 1;
    rightEye.scale.y = blinking ? 0.12 : 1;
    leftHighlight.visible = !blinking;
    rightHighlight.visible = !blinking;

    // Breathing, head sway, and a small body bob.
    const breath = Math.sin(time * 2.1) * 0.028;
    bodyGroup.scale.y = 1 + breath;
    bodyGroup.position.y = Math.sin(time * 2.1) * 0.035;
    root.position.y = Math.sin(time * 2.1) * 0.05 + jumpOffset;
    headGroup.rotation.z = Math.sin(time * 1.4) * 0.028;
    headGroup.rotation.y = Math.cos(time * 1.1) * 0.04;
    headGroup.position.y = HEAD_PIVOT_Y + Math.sin(time * 2.1 + 0.6) * 0.04;
    trunkGroup.rotation.x = Math.sin(time * 2.4) * 0.05;
    trunkGroup.rotation.z = Math.cos(time * 1.9) * 0.035;
    scarfTailGroup.rotation.z = Math.sin(time * 2.8) * 0.08;
    tail.rotation.z = Math.sin(time * 2.3 + 1.2) * 0.1;
    leftEar.rotation.y = 0.06 + Math.sin(time * 1.7) * 0.03;
    rightEar.rotation.y = -0.06 - Math.sin(time * 1.7) * 0.03;
    magnifierGroup.position.y = MAG_BASE_Y + Math.sin(time * 2.6) * 0.03;

    if (pose === 'walk') {
      const stride = Math.sin(time * 4.2);
      legs.forEach((leg) => {
        const phase = Math.sin(time * 4.2 + leg.phase);
        leg.mesh.position.y = leg.baseY + Math.max(0, phase) * 0.58;
        leg.mesh.rotation.x = phase * 0.2;
      });
      bodyGroup.position.y += Math.abs(stride) * 0.08;
      root.position.y += Math.abs(stride) * 0.05;
      headGroup.rotation.x = Math.sin(time * 4.2) * 0.03;
      trunkGroup.rotation.x += Math.sin(time * 4.2) * 0.08;
    }

    if (pose === 'scan') {
      headGroup.rotation.x = -0.12;
      headGroup.rotation.y = Math.sin(time * 1.8) * 0.14;
      trunkGroup.rotation.x = -0.5 + Math.sin(time * 2.2) * 0.05;
      magnifierGroup.rotation.z = -0.38 + Math.sin(time * 3.2) * 0.1;
      lensLight.intensity = 1.5 + Math.sin(time * 5) * 0.35;
    } else {
      lensLight.intensity = 1.5;
    }

    if (pose === 'celebrate') {
      headGroup.rotation.z = Math.sin(time * 5.2) * 0.13;
      headGroup.rotation.y = Math.sin(time * 2.6) * 0.08;
      scarfTailGroup.rotation.z = Math.sin(time * 6.4) * 0.22;
      leftEar.rotation.y = 0.06 + Math.sin(time * 5.2) * 0.12;
      rightEar.rotation.y = -0.06 - Math.sin(time * 5.2) * 0.12;
      trunkGroup.rotation.x = -0.25 + Math.sin(time * 6) * 0.16;
      magnifierGroup.position.y = MAG_BASE_Y + 0.25 + Math.sin(time * 6) * 0.18;
      root.position.y += Math.abs(Math.sin(time * 5.2)) * Math.max(jumpHeight, 0.55);
    }
  };

  const dispose = (): void => {
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        if (Array.isArray(mesh.material)) mesh.material.forEach((mat) => mat.dispose());
        else (mesh.material as THREE.Material).dispose();
      }
    });
  };

  return { group: root, animate, setVerdict, dispose };
}
