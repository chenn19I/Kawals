import { useEffect, useRef, useState, type ReactElement } from 'react';
import type { Screen } from '../state/useHashScreen';
import { useLang } from '../lib/i18n';
import { Button } from './Button';
import { Icon } from './Icon';

interface GuideStep {
  screen: Screen;
  en: string;
  id: string;
  hintEn: string;
  hintId: string;
}

const STEPS: GuideStep[] = [
  {
    screen: 'market',
    en: 'Open the mock market',
    id: 'Buka pasar tiruan',
    hintEn: 'Twelve fixtures are labelled demo replay. Start with any card.',
    hintId: 'Dua belas fixture diberi label replay demo. Mulai dari kartu mana saja.',
  },
  {
    screen: 'market',
    en: 'Scan one case',
    id: 'Pindai satu kasus',
    hintEn: 'Open a case file and watch the conveyor, arch, and four staged reads.',
    hintId: 'Buka berkas kasus dan lihat ban berjalan, lengkung, dan empat bacaan bertahap.',
  },
  {
    screen: 'market',
    en: 'Save your decision',
    id: 'Simpan keputusanmu',
    hintEn: 'The engine verdict is fixed. Pick pass, hold, or reject. A reject also writes a blocked address.',
    hintId: 'Putusan mesin tetap. Pilih lolos, tahan, atau tolak. Tolak juga menulis alamat diblokir.',
  },
  {
    screen: 'memory',
    en: 'Open Yang Kuingat',
    id: 'Buka Yang Kuingat',
    hintEn: 'The new cell carries a stable code, a source badge, and usage evidence.',
    hintId: 'Sel baru punya kode tetap, label sumber, dan bukti pemakaian.',
  },
  {
    screen: 'market',
    en: 'Check the same fixture again',
    id: 'Periksa fixture yang sama lagi',
    hintEn: 'A blocked address is recalled on the next scan and rule R2 can fire.',
    hintId: 'Alamat yang diblokir dipanggil pada pemindaian berikutnya dan aturan R2 bisa menyala.',
  },
  {
    screen: 'status',
    en: 'Pull the guard',
    id: 'Cabut penjaga',
    hintEn: 'Revoke stops new checks. It is a local session flag, not an on-chain delegate revocation.',
    hintId: 'Cabut menghentikan pemeriksaan baru. Ini penanda sesi lokal, bukan pencabutan delegate on-chain.',
  },
  {
    screen: 'status',
    en: 'Restore the guard',
    id: 'Pulihkan penjaga',
    hintEn: 'Restore re-enables checks for this session. The guard status screen shows the current state.',
    hintId: 'Pulihkan mengaktifkan lagi pemeriksaan untuk sesi ini. Layar status menunjukkan keadaan saat ini.',
  },
];

const SCREEN_LABEL: Record<Screen, { en: string; id: string }> = {
  home: { en: 'Home', id: 'Beranda' },
  check: { en: 'Check', id: 'Periksa' },
  market: { en: 'Market', id: 'Pasar' },
  learning: { en: 'Learning', id: 'Belajar' },
  memory: { en: 'Memory', id: 'Memori' },
  status: { en: 'Status', id: 'Status' },
  maskot: { en: 'Maskot', id: 'Maskot' },
};

export function GuidedDemo({
  open,
  onClose,
  navigate,
}: {
  open: boolean;
  onClose: () => void;
  navigate: (screen: Screen) => void;
}): ReactElement | null {
  const { tx, lang } = useLang();
  const [current, setCurrent] = useState(0);
  const [finished, setFinished] = useState(false);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 30);
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      restoreRef.current?.focus();
    };
  }, [onClose, open]);

  useEffect(() => {
    if (open) {
      setCurrent(0);
      setFinished(false);
    }
  }, [open]);

  if (!open) return null;

  const step = STEPS[current]!;

  const go = (screen: Screen): void => {
    onClose();
    navigate(screen);
  };

  const next = (): void => {
    if (current + 1 >= STEPS.length) {
      setFinished(true);
      return;
    }
    setCurrent((value) => value + 1);
  };

  return (
    <div
      className="guided-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="guided-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="guided-title"
      >
        <div className="guided-sheet__head">
          <div>
            <span className="mono guided-sheet__step">
              {finished ? tx('COMPLETE', 'SELESAI') : `${String(current + 1).padStart(2, '0')} / 07`}
            </span>
            <h2 id="guided-title">
              {finished
                ? tx('The route is open.', 'Rutenya sudah terbuka.')
                : lang === 'en'
                  ? step.en
                  : step.id}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label={tx('Close guided demo', 'Tutup demo terpandu')}
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        {finished ? (
          <div className="guided-finish">
            <span className="guided-finish__mark" aria-hidden="true">
              <Icon name="check" size={26} />
            </span>
            <p>
              {tx(
                'You have the full route: scan, decide, remember, recheck, pull, restore. Every screen is reachable from the header.',
                'Kamu sudah punya rute lengkap: pindai, putuskan, ingat, periksa ulang, cabut, pulihkan. Semua layar bisa dibuka dari header.',
              )}
            </p>
            <div className="guided-sheet__foot">
              <Button variant="quiet" size="sm" onClick={() => setCurrent(0)}>
                {tx('Replay the guide', 'Ulangi panduan')}
              </Button>
              <Button variant="primary" onClick={onClose}>
                {tx('Close', 'Tutup')}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="guided-progress" aria-hidden="true">
              {STEPS.map((item, index) => (
                <span
                  key={item.en}
                  className={
                    index < current ? 'is-done' : index === current ? 'is-active' : ''
                  }
                />
              ))}
            </div>

            <div className="guided-sheet__hint">
              <Icon name="scan" size={17} />
              <p>{lang === 'en' ? step.hintEn : step.hintId}</p>
            </div>

            <div className="guided-sheet__rows">
              {STEPS.map((item, index) => (
                <div
                  key={item.en}
                  className={[
                    'guided-sheet__row',
                    index === current ? 'is-active' : '',
                    index < current ? 'is-done' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <span className="guided-sheet__dot" aria-hidden="true">
                    {index < current ? <Icon name="check" size={11} /> : null}
                  </span>
                  <span className="guided-sheet__label">
                    {lang === 'en' ? item.en : item.id}
                  </span>
                  <span className="mono guided-sheet__screen">
                    {SCREEN_LABEL[item.screen][lang]}
                  </span>
                </div>
              ))}
            </div>

            <div className="guided-sheet__foot">
              <Button
                variant="quiet"
                size="sm"
                onClick={() => setCurrent((value) => Math.max(0, value - 1))}
                disabled={current === 0}
              >
                {tx('Back', 'Kembali')}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => go(step.screen)}
              >
                {tx(`Open ${SCREEN_LABEL[step.screen].en}`, `Buka ${SCREEN_LABEL[step.screen].id}`)}
              </Button>
              <Button variant="primary" size="sm" onClick={next}>
                {current + 1 >= STEPS.length
                  ? tx('Finish', 'Selesai')
                  : tx('Next step', 'Langkah berikutnya')}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
