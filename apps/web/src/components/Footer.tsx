import type { ReactElement } from 'react';
import { useLang } from '../lib/i18n';
import type { Screen } from '../state/useHashScreen';

export function Footer({ navigate }: { navigate: (screen: Screen) => void }): ReactElement {
  const { tx } = useLang();
  return (
    <footer className="site-footer">
      <div className="site-footer__main">
        <div className="site-footer__brand">
          <span className="site-footer__mark" aria-hidden="true">K</span>
          <div>
            <strong>Kawal</strong>
            <p>
              {tx(
                'A transaction checkpoint for Sui. Check the intent before your wallet signs.',
                'Pos pemeriksaan transaksi Sui. Periksa maksud transfer sebelum dompet menandatangani.',
              )}
            </p>
          </div>
        </div>

        <div className="site-footer__links">
          <button type="button" onClick={() => navigate('check')}>
            {tx('Check a transfer', 'Periksa transfer')}
          </button>
          <button type="button" onClick={() => navigate('memory')}>
            {tx('Walrus Memory', 'Memori Walrus')}
          </button>
          <button type="button" onClick={() => navigate('status')}>
            {tx('Guard status', 'Status penjaga')}
          </button>
        </div>
      </div>

      <div className="site-footer__base">
        <span>{tx('Sui · Walrus Memory · Tatum', 'Sui · Memori Walrus · Tatum')}</span>
        <span>
          {tx(
            'No wallet signing in this build',
            'Build ini tidak menandatangani transaksi',
          )}
        </span>
      </div>
    </footer>
  );
}
