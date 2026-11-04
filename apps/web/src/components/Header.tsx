import { useEffect, useState, type ReactElement } from 'react';
import type { Screen } from '../state/useHashScreen';
import { useLang } from '../lib/i18n';
import { useHealth } from '../hooks/useHealth';
import { Icon } from './Icon';

const NAV: Array<{ screen: Screen; en: string; id: string }> = [
  { screen: 'check', en: 'Check', id: 'Periksa' },
  { screen: 'market', en: 'Market', id: 'Pasar' },
  { screen: 'learning', en: 'Learning', id: 'Belajar' },
  { screen: 'memory', en: 'Memory', id: 'Memori' },
  { screen: 'status', en: 'Status', id: 'Status' },
  { screen: 'maskot', en: 'Maskot', id: 'Maskot' },
];

function Logo({
  onClick,
  label,
  tagline,
}: {
  onClick: () => void;
  label: string;
  tagline: string;
}): ReactElement {
  return (
    <a
      className="logo"
      href="#/"
      onClick={(event) => {
        event.preventDefault();
        onClick();
      }}
      aria-label={label}
    >
      <span className="logo__mark" aria-hidden="true">
        <svg viewBox="0 0 32 32" width="32" height="32">
          <rect x="1" y="1" width="30" height="30" fill="currentColor" />
          <path d="M8 23V9h4v5.6L17.8 9H23l-6.8 6.6L23.4 23h-5.2l-4.5-5.6-.7.6V23Z" fill="#f5f3ec" />
          <path d="m22.5 5.5 3 3" stroke="#f5f3ec" strokeWidth="2" />
        </svg>
      </span>
      <span className="logo__type">
        <strong>Kawal</strong>
        <small>{tagline}</small>
      </span>
    </a>
  );
}

export function Header({
  active,
  navigate,
}: {
  active: Screen;
  navigate: (screen: Screen) => void;
}): ReactElement {
  const { tx, lang, setLang } = useLang();
  const { health, error } = useHealth();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [active]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const online = Boolean(health) && !error;
  const statusLabel = !online
    ? tx('API offline', 'API offline')
    : health?.guard === 'revoked'
      ? tx('Guard revoked', 'Penjaga dicabut')
      : tx('API online', 'API online');

  const go = (screen: Screen): void => {
    navigate(screen);
    setOpen(false);
  };

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Logo
          onClick={() => go('home')}
          label={tx('Kawal home', 'Beranda Kawal')}
          tagline={tx('Sui transfer guard', 'Penjaga transfer Sui')}
        />

        <nav className="main-nav" aria-label={tx('Main navigation', 'Navigasi utama')}>
          {NAV.map((item) => (
            <a
              key={item.screen}
              href={`#/${item.screen}`}
              className={active === item.screen ? 'is-active' : ''}
              aria-current={active === item.screen ? 'page' : undefined}
              onClick={(event) => {
                event.preventDefault();
                go(item.screen);
              }}
            >
              {tx(item.en, item.id)}
            </a>
          ))}
        </nav>

        <div className="header-tools">
          <span
            className={`api-status ${online ? 'is-online' : 'is-offline'}`}
            title={statusLabel}
          >
            <span className="api-status__dot" aria-hidden="true" />
            <span className="api-status__text">{statusLabel}</span>
          </span>

          <div className="lang-switch" role="group" aria-label={tx('Language', 'Bahasa')}>
            <button
              type="button"
              className={lang === 'en' ? 'is-active' : ''}
              aria-pressed={lang === 'en'}
              onClick={() => setLang('en')}
            >
              EN
            </button>
            <button
              type="button"
              className={lang === 'id' ? 'is-active' : ''}
              aria-pressed={lang === 'id'}
              onClick={() => setLang('id')}
            >
              ID
            </button>
          </div>

          <button
            type="button"
            className="menu-button"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? tx('Close menu', 'Tutup menu') : tx('Open menu', 'Buka menu')}
            onClick={() => setOpen((value) => !value)}
          >
            <Icon name={open ? 'x' : 'menu'} size={22} />
          </button>
        </div>
      </div>

      <div id="mobile-nav" className={`mobile-nav ${open ? 'is-open' : ''}`} hidden={!open}>
        <nav aria-label={tx('Mobile navigation', 'Navigasi seluler')}>
          {NAV.map((item, index) => (
            <a
              key={item.screen}
              href={`#/${item.screen}`}
              className={active === item.screen ? 'is-active' : ''}
              aria-current={active === item.screen ? 'page' : undefined}
              onClick={(event) => {
                event.preventDefault();
                go(item.screen);
              }}
            >
              <span className="mobile-nav__index">{String(index + 1).padStart(2, '0')}</span>
              <span>{tx(item.en, item.id)}</span>
              <Icon name="chevron-right" size={18} />
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
