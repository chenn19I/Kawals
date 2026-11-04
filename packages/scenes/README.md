# packages/scenes

Belum diisi. Komponen Three murni untuk adegan "Pos Pemeriksaan".

## Kontrak

```ts
type SceneState = {
  phase: 'masuk' | 'memindai' | 'putusan';
  packageContents: Array<'koin' | 'objek' | 'kontrak'>;
  decision: 'LOLOS' | 'TAHAN' | 'TOLAK' | null;
};

function scene(state: SceneState, t: number): void;
```

- Tanpa jam sendiri. `t` datang dari `useFrame` di aplikasi dan `useCurrentFrame` di Remotion.
- Anggaran: di bawah 60 ribu segitiga, DPR maksimal 1,75, GLB Draco di bawah 600 KB.
- Pak Wal di bawah 3.000 segitiga, tiga pose tanpa rig tulang.
- Isi paket disingkap lewat clipping plane, bukan partikel.
