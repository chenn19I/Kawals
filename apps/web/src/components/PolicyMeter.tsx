import type { ReactElement } from 'react';
import type { ThresholdKey } from '@kawal/rules';
import type { ThresholdDto } from '../lib/api';
import { cellCode } from '../lib/cells';
import { THRESHOLD_LABEL } from '../lib/copy';
import { useLang } from '../lib/i18n';

interface PolicyMeterProps {
  thresholdKey: ThresholdKey;
  threshold: ThresholdDto;
  amountSui: string;
  applicable?: boolean;
}

export function PolicyMeter({
  thresholdKey,
  threshold,
  amountSui,
  applicable = true,
}: PolicyMeterProps): ReactElement {
  const { tx, lang } = useLang();
  const amount = Number(amountSui);
  const limit = Number(threshold.sui);
  const ratio = limit > 0 && Number.isFinite(amount) ? amount / limit : 0;
  const rawPercentage = Math.max(0, Math.round(ratio * 100));
  const fillWidth = applicable ? Math.min(100, rawPercentage) : 0;
  const tone = !applicable ? 'inactive' : ratio > 1 ? 'over' : ratio >= 0.8 ? 'near' : 'safe';
  const label = THRESHOLD_LABEL[thresholdKey][lang];
  const source = threshold.memory
    ? cellCode(threshold.memory.id)
    : tx('Built-in default', 'Bawaan');

  return (
    <div className={`policy-meter policy-meter--${tone}`}>
      <div className="policy-meter__head">
        <span className="policy-meter__label">{label}</span>
        <span className="mono policy-meter__value">
          {amountSui} / {threshold.sui} SUI
        </span>
      </div>
      <div
        className="policy-meter__track"
        role="img"
        aria-label={
          applicable
            ? tx(
                `${label}: ${amountSui} of a ${threshold.sui} SUI limit, ${rawPercentage} percent.`,
                `${label}: ${amountSui} dari batas ${threshold.sui} SUI, ${rawPercentage} persen.`,
              )
            : tx(
                `${label}: not used for this transfer.`,
                `${label}: tidak dipakai untuk transfer ini.`,
              )
        }
      >
        <span
          className="policy-meter__fill"
          style={{ width: `${fillWidth}%` }}
          aria-hidden="true"
        />
        <span className="policy-meter__ticks" aria-hidden="true" />
        <span className="policy-meter__limit" aria-hidden="true" />
      </div>
      <div className="policy-meter__foot">
        <span className="mono">{source}</span>
        <span className="mono">
          {applicable ? `${rawPercentage}%` : tx('NOT USED', 'TIDAK DIPAKAI')}
        </span>
      </div>
    </div>
  );
}
