import { useState, type ReactElement } from 'react';
import { safeNormalizeAddress, shortAddress } from '@kawal/rules';
import { Icon } from './Icon';
import { useLang } from '../lib/i18n';

export function Address({
  value,
  full = false,
  copyable = true,
  label,
}: {
  value: string;
  full?: boolean;
  copyable?: boolean;
  label?: string;
}): ReactElement {
  const { tx } = useLang();
  const [copied, setCopied] = useState(false);
  const normalized = safeNormalizeAddress(value);
  const text = full || !normalized ? value : shortAddress(normalized);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(normalized ?? value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <span className="address">
      <code className="address__value" title={value}>
        {text}
      </code>
      {copyable && normalized ? (
        <button
          type="button"
          className="address__copy"
          onClick={copy}
          aria-label={
            copied
              ? tx(`${label ?? 'Address'} copied`, `${label ?? 'Alamat'} disalin`)
              : tx(`Copy ${label ?? 'address'}`, `Salin ${label ?? 'alamat'}`)
          }
        >
          <Icon name={copied ? 'check' : 'copy'} size={14} />
          <span className="sr-only">
            {copied
              ? tx('Copied', 'Disalin')
              : tx(`Copy ${label ?? 'address'}`, `Salin ${label ?? 'alamat'}`)}
          </span>
        </button>
      ) : null}
    </span>
  );
}
