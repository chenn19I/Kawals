import type { Decision } from '@kawal/rules';
import type { ReactElement } from 'react';
import { DECISION_COPY, decisionCopy } from '../lib/copy';
import { useLang } from '../lib/i18n';
import { Icon } from './Icon';

export function DecisionStamp({
  decision,
  size = 'md',
}: {
  decision: Decision;
  size?: 'sm' | 'md' | 'lg';
}): ReactElement {
  const { lang } = useLang();
  const copy = decisionCopy(decision, lang);
  return (
    <span
      className={`decision-stamp decision-stamp--${DECISION_COPY[decision].tone} decision-stamp--${size}`}
    >
      <Icon name={DECISION_COPY[decision].icon} size={size === 'lg' ? 24 : 16} strokeWidth={2.2} />
      <span>{copy.label}</span>
    </span>
  );
}

export function DecisionMark({
  decision,
  className = '',
}: {
  decision: Decision;
  className?: string;
}): ReactElement {
  const { lang } = useLang();
  return (
    <span className={`decision-mark decision-mark--${DECISION_COPY[decision].tone} ${className}`.trim()}>
      <span className="decision-mark__icon">
        <Icon name={DECISION_COPY[decision].icon} size={26} strokeWidth={2.4} />
      </span>
      <span className="decision-mark__text">{decisionCopy(decision, lang).label}</span>
    </span>
  );
}
