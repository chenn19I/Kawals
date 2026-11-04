import type { ReactElement } from 'react';
import { useLang } from '../lib/i18n';

const RADIUS = 54;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function AgreementDial({
  matched,
  total,
}: {
  matched: number;
  total: number;
}): ReactElement {
  const { tx } = useLang();
  const value = total > 0 ? Math.round((matched / total) * 100) : 0;
  const offset = CIRCUMFERENCE * (1 - value / 100);

  return (
    <div
      className="agreement-dial"
      role="img"
      aria-label={tx(
        `${value} percent of ${total} saved decisions match the engine recommendation.`,
        `${value} persen dari ${total} keputusan tersimpan sejalan dengan rekomendasi mesin.`,
      )}
    >
      <svg viewBox="0 0 140 140" aria-hidden="true">
        <circle className="agreement-dial__ticks" cx="70" cy="70" r="64" />
        <circle className="agreement-dial__track" cx="70" cy="70" r={RADIUS} />
        <circle
          className="agreement-dial__arc"
          cx="70"
          cy="70"
          r={RADIUS}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
        />
        <circle className="agreement-dial__core" cx="70" cy="70" r="35" />
      </svg>
      <div className="agreement-dial__center" aria-hidden="true">
        <strong>{value}%</strong>
        <span className="mono">{tx('ALIGNED', 'SEJALAN')}</span>
      </div>
      <span className="agreement-dial__pin agreement-dial__pin--a" aria-hidden="true" />
      <span className="agreement-dial__pin agreement-dial__pin--b" aria-hidden="true" />
    </div>
  );
}
