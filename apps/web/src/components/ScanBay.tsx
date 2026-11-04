import { lazy, Suspense, type ReactElement } from 'react';
import type { Decision } from '@kawal/rules';
import { useLang } from '../lib/i18n';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { Icon } from './Icon';

// The Three.js scanner is loaded only when a case is opened. The flat CSS
// scanner below stays as the pre-load and reduced-motion fallback.
const LazyScanBay3D = lazy(async () => {
  const module = await import('./ScanBay3D');
  return { default: module.ScanBay3D };
});

export type ScanPhase = 'idle' | 'scanning' | 'verdict' | 'error';

export interface ScanStage {
  en: string;
  id: string;
  detailEn: string;
  detailId: string;
}

export const SCAN_STAGES: ScanStage[] = [
  {
    en: 'Read the transfer packet',
    id: 'Baca isi paket transfer',
    detailEn: 'Amount, recipient, package calls, and objects leaving the wallet.',
    detailId: 'Nominal, penerima, paket yang dipanggil, dan objek yang keluar dari dompet.',
  },
  {
    en: 'Recall Walrus Memory',
    id: 'Panggil Memori Walrus',
    detailEn: 'Address notes, spending rules, and earlier decisions for this recipient.',
    detailId: 'Catatan alamat, aturan belanja, dan keputusan lama untuk penerima ini.',
  },
  {
    en: 'Run rules R1 to R9',
    id: 'Jalankan aturan R1 sampai R9',
    detailEn: 'The deterministic engine collects every finding. The heaviest verdict wins.',
    detailId: 'Mesin deterministik mengumpulkan semua temuan. Putusan terberat menang.',
  },
  {
    en: 'Stamp the case file',
    id: 'Bubuhkan cap berkas kasus',
    detailEn: 'The verdict is written to the slip with the rules that produced it.',
    detailId: 'Putusan ditulis ke slip bersama aturan yang menghasilkannya.',
  },
];

const VERDICT_LABEL: Record<Decision, { en: string; id: string }> = {
  LOLOS: { en: 'PASS', id: 'LOLOS' },
  TAHAN: { en: 'HOLD', id: 'TAHAN' },
  TOLAK: { en: 'REJECT', id: 'TOLAK' },
};

function FlatScanner({
  phase,
  caseLabel,
}: {
  phase: ScanPhase;
  caseLabel?: string;
}): ReactElement {
  const scanning = phase === 'scanning';
  const done = phase === 'verdict';
  const failed = phase === 'error';

  return (
    <>
      <div className="scan-bay__belt">
        <span className="scan-bay__belt-line" />
        <span className="scan-bay__belt-line" />
        <span className="scan-bay__belt-line" />
        <span className="scan-bay__belt-line" />
      </div>

      <div className={`scan-bay__arch ${scanning ? 'is-scanning' : ''}`}>
        <span className="scan-bay__lamp scan-bay__lamp--a" />
        <span className="scan-bay__lamp scan-bay__lamp--b" />
        <span className="scan-bay__lamp scan-bay__lamp--c" />
        <span className="scan-bay__arch-label mono">X-RAY</span>
        <span className="scan-bay__beam" />
      </div>

      <div
        className={`scan-bay__case ${scanning ? 'is-scanning' : done ? 'is-done' : failed ? 'is-failed' : ''}`}
      >
        <span className="scan-bay__handle" />
        <span className="scan-bay__case-body">
          <span className="scan-bay__strap scan-bay__strap--left" />
          <span className="scan-bay__strap scan-bay__strap--right" />
          <span className="scan-bay__tag mono">{caseLabel ?? 'CASE / 01'}</span>
          <span className="scan-bay__case-glow" />
        </span>
        <span className="scan-bay__wheel scan-bay__wheel--left" />
        <span className="scan-bay__wheel scan-bay__wheel--right" />
      </div>

      <span className="scan-bay__floor" />
    </>
  );
}

interface ScanBayProps {
  phase: ScanPhase;
  activeStage: number;
  verdict?: Decision | null;
  caseLabel?: string;
  mode?: 'demo' | 'live';
  compact?: boolean;
}

export function ScanBay({
  phase,
  activeStage,
  verdict,
  caseLabel,
  mode = 'demo',
  compact = false,
}: ScanBayProps): ReactElement {
  const { tx, lang } = useLang();
  const reducedMotion = usePrefersReducedMotion();
  const tone = verdict
    ? verdict === 'LOLOS'
      ? 'pass'
      : verdict === 'TAHAN'
        ? 'hold'
        : 'block'
    : null;
  const scanning = phase === 'scanning';
  const done = phase === 'verdict';
  const failed = phase === 'error';
  const current = Math.max(0, Math.min(SCAN_STAGES.length - 1, activeStage));

  const status =
    phase === 'idle'
      ? tx('Scanner idle. Open a case to begin.', 'Pemindai siaga. Buka kasus untuk mulai.')
      : scanning
        ? tx(
            `Reading stage ${current + 1} of ${SCAN_STAGES.length}.`,
            `Membaca tahap ${current + 1} dari ${SCAN_STAGES.length}.`,
          )
        : failed
          ? tx('The scan stopped before a verdict.', 'Pemindaian berhenti sebelum putusan.')
          : done && verdict
            ? tx(
                `Verdict stamped: ${VERDICT_LABEL[verdict].en}.`,
                `Cap putusan: ${VERDICT_LABEL[verdict].id}.`,
              )
            : tx('Scan complete.', 'Pemindaian selesai.');

  return (
    <section
      className={[
        'scan-bay',
        `scan-bay--${phase}`,
        tone ? `scan-bay--${tone}` : '',
        compact ? 'scan-bay--compact' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={tx('Transaction scanner', 'Pemindai transaksi')}
    >
      <div className="scan-bay__top">
        <span className="mono scan-bay__code">
          {mode === 'live' ? 'LIVE READ / 02' : 'DEMO REPLAY / 02'}
        </span>
        <span className={`scan-bay__mode ${mode === 'live' ? 'is-live' : 'is-demo'}`}>
          <span aria-hidden="true" />
          {mode === 'live' ? tx('Tatum + Walrus', 'Tatum + Walrus') : tx('Fixture data', 'Data fixture')}
        </span>
      </div>

      <div className="scan-bay__viewport" aria-hidden="true">
        {reducedMotion ? (
          <FlatScanner phase={phase} caseLabel={caseLabel} />
        ) : (
          <Suspense fallback={<FlatScanner phase={phase} caseLabel={caseLabel} />}>
            <LazyScanBay3D phase={phase} verdict={verdict ?? null} />
          </Suspense>
        )}
      </div>

      <div className="scan-bay__readout">
        <span className={`scan-bay__signal ${scanning ? 'is-scanning' : done ? 'is-done' : failed ? 'is-error' : ''}`}>
          <span aria-hidden="true" />
          {status}
        </span>
        {done && verdict ? (
          <span className={`scan-bay__verdict scan-bay__verdict--${tone}`}>
            <Icon name={verdict === 'LOLOS' ? 'check' : verdict === 'TAHAN' ? 'pause' : 'x'} size={16} />
            {lang === 'en' ? VERDICT_LABEL[verdict].en : VERDICT_LABEL[verdict].id}
          </span>
        ) : null}
      </div>

      <ol className="scan-steps">
        {SCAN_STAGES.map((stage, index) => {
          const stageDone = done || index < current;
          const stageActive = scanning && index === current;
          const stageFailed = failed && index === current;
          return (
            <li
              key={stage.en}
              className={[
                'scan-step',
                stageDone ? 'is-done' : '',
                stageActive ? 'is-active' : '',
                stageFailed ? 'is-failed' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className="scan-step__index mono">{String(index + 1).padStart(2, '0')}</span>
              <span className="scan-step__body">
                <strong>{lang === 'en' ? stage.en : stage.id}</strong>
                <span>{lang === 'en' ? stage.detailEn : stage.detailId}</span>
              </span>
              <span className="scan-step__mark" aria-hidden="true">
                {stageDone ? <Icon name="check" size={13} /> : stageFailed ? <Icon name="x" size={13} /> : null}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
