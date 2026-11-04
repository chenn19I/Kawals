import { useState, type ReactElement } from 'react';
import { useLang } from '../lib/i18n';
import type { ElephantPose, ElephantVerdict } from '../lib/elephant';
import { ElephantMascot } from './ElephantMascot';
import { Icon } from './Icon';

const POSES: Array<{ pose: ElephantPose; en: string; id: string; noteEn: string; noteId: string }> = [
  { pose: 'idle', en: 'Idle', id: 'Diam', noteEn: 'Breathing, with a blink every 3.4 seconds.', noteId: 'Bernapas, berkedip tiap 3,4 detik.' },
  { pose: 'walk', en: 'Walk', id: 'Jalan', noteEn: 'A short in-place walk cycle for the checkpoint.', noteId: 'Siklus jalan di tempat untuk pos pemeriksaan.' },
  { pose: 'scan', en: 'Scan', id: 'Pindai', noteEn: 'The magnifier rises while the lens reads the case.', noteId: 'Kaca pembesar naik saat lensa membaca kasus.' },
  { pose: 'celebrate', en: 'Celebrate', id: 'Rayakan', noteEn: 'An optional jump for a pass verdict.', noteId: 'Lompatan opsional untuk putusan lolos.' },
];

const VERDICTS: Array<{ verdict: ElephantVerdict; en: string; id: string; tone: string }> = [
  { verdict: 'pass', en: 'Pass', id: 'Lolos', tone: 'pass' },
  { verdict: 'hold', en: 'Hold', id: 'Tahan', tone: 'hold' },
  { verdict: 'reject', en: 'Reject', id: 'Tolak', tone: 'block' },
];

export function MaskotGalleryScreen(): ReactElement {
  const { tx, lang } = useLang();
  const [pose, setPose] = useState<ElephantPose>('idle');
  const [verdict, setVerdict] = useState<ElephantVerdict>('hold');
  const activePose = POSES.find((item) => item.pose === pose) ?? POSES[0]!;
  const activeVerdict = VERDICTS.find((item) => item.verdict === verdict) ?? VERDICTS[1]!;

  return (
    <div className="maskot-gallery">
      <header className="page-intro page-intro--split">
        <div>
          <p className="eyebrow">{tx('Maskot lab', 'Lab maskot')}</p>
          <h1>{tx('One canvas. Every pose.', 'Satu kanvas. Semua pose.')}</h1>
          <p>
            {tx(
              'The voxel detective is built from boxes, fits an orthographic isometric camera, and only runs while it is on screen. Change the pose and lens to inspect the rig.',
              'Detektif voxel dibangun dari kotak, memakai kamera isometrik ortografis, dan hanya berjalan saat terlihat. Ubah pose dan lensa untuk memeriksa rig.',
            )}
          </p>
        </div>
        <div className="page-intro__side">
          <span className="mode-badge is-live">
            <span className="mode-badge__dot" aria-hidden="true" />
            {tx('Live canvas', 'Kanvas live')}
          </span>
          <span className="page-intro__count mono">DPR 1-2</span>
        </div>
      </header>

      <div className="gallery-layout">
        <section className="gallery-stage" aria-label={tx('Mascot preview', 'Pratinjau maskot')}>
          <div className="gallery-stage__top">
            <span className="mono">MASKOT / 04</span>
            <span className={`gallery-stage__verdict gallery-stage__verdict--${activeVerdict.tone}`}>
              <Icon
                name={verdict === 'pass' ? 'check' : verdict === 'hold' ? 'pause' : 'x'}
                size={14}
              />
              {lang === 'en' ? activeVerdict.en : activeVerdict.id}
            </span>
          </div>
          <ElephantMascot
            pose={pose}
            verdict={verdict}
            scale={0.38}
            jumpHeight={pose === 'celebrate' ? 0.45 : 0}
            label={tx('Voxel detective elephant', 'Gajah detektif voxel')}
            className="gallery-stage__canvas"
          />
          <div className="gallery-stage__caption">
            <div>
              <strong>{lang === 'en' ? activePose.en : activePose.id}</strong>
              <span>{tx('Decorative, never the only verdict signal', 'Dekoratif, bukan satu-satunya penanda putusan')}</span>
            </div>
            <p>{lang === 'en' ? activePose.noteEn : activePose.noteId}</p>
          </div>
        </section>

        <section className="gallery-controls" aria-label={tx('Mascot controls', 'Kontrol maskot')}>
          <div className="gallery-control">
            <span className="mono gallery-control__label">{tx('Pose', 'Pose')}</span>
            <div className="gallery-control__buttons" role="group" aria-label={tx('Pose', 'Pose')}>
              {POSES.map((item) => (
                <button
                  key={item.pose}
                  type="button"
                  className={pose === item.pose ? 'is-active' : ''}
                  aria-pressed={pose === item.pose}
                  onClick={() => setPose(item.pose)}
                >
                  {lang === 'en' ? item.en : item.id}
                </button>
              ))}
            </div>
          </div>

          <div className="gallery-control">
            <span className="mono gallery-control__label">{tx('Verdict lens', 'Lensa putusan')}</span>
            <div className="gallery-control__buttons" role="group" aria-label={tx('Verdict lens', 'Lensa putusan')}>
              {VERDICTS.map((item) => (
                <button
                  key={item.verdict}
                  type="button"
                  className={`gallery-control__verdict gallery-control__verdict--${item.tone} ${verdict === item.verdict ? 'is-active' : ''}`}
                  aria-pressed={verdict === item.verdict}
                  onClick={() => setVerdict(item.verdict)}
                >
                  <span className="gallery-control__dot" aria-hidden="true" />
                  {lang === 'en' ? item.en : item.id}
                </button>
              ))}
            </div>
          </div>

          <dl className="gallery-facts">
            <div>
              <dt>{tx('Geometry', 'Geometri')}</dt>
              <dd>{tx('About 30 boxes', 'Sekitar 30 kotak')}</dd>
            </div>
            <div>
              <dt>{tx('Camera', 'Kamera')}</dt>
              <dd>{tx('Orthographic isometric', 'Isometrik ortografis')}</dd>
            </div>
            <div>
              <dt>{tx('Blink', 'Kedip')}</dt>
              <dd>{tx('Every 3.4 seconds', 'Tiap 3,4 detik')}</dd>
            </div>
            <div>
              <dt>{tx('Fallback', 'Cadangan')}</dt>
              <dd>{tx('Static SVG', 'SVG statis')}</dd>
            </div>
          </dl>
        </section>
      </div>

      <p className="maskot-footnote">
        {tx(
          'The maskot is decorative. Every decision is announced in text and icon, never by colour alone.',
          'Maskot adalah dekorasi. Setiap keputusan dinyatakan dalam teks dan ikon, tidak hanya warna.',
        )}
      </p>
    </div>
  );
}
