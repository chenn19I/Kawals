import type { ReactElement, ReactNode } from 'react';
import type { IconName } from '../lib/copy';

const PATHS: Record<IconName, ReactNode> = {
  'arrow-right': (
    <>
      <path d="M4 12h15" />
      <path d="m13 6 6 6-6 6" />
    </>
  ),
  check: <path d="m5 12.5 4.2 4.2L19 6.8" />,
  'chevron-down': <path d="m6 9 6 6 6-6" />,
  'chevron-right': <path d="m9 6 6 6-6 6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="10" height="11" rx="1.5" />
      <path d="M15.5 8.5V6A1.5 1.5 0 0 0 14 4.5H6A1.5 1.5 0 0 0 4.5 6v9A1.5 1.5 0 0 0 6 16.5h2.5" />
    </>
  ),
  external: (
    <>
      <path d="M13 4.5h6.5V11" />
      <path d="m19.5 4.5-8 8" />
      <path d="M18.5 14v4a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V7A1.5 1.5 0 0 1 6 5.5h4" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5" />
      <path d="M12 7.8v.2" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="10" rx="1.5" />
      <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
      <path d="M12 14v2" />
    </>
  ),
  memory: (
    <>
      <rect x="4" y="5" width="16" height="14" rx="1.5" />
      <path d="M8 9h8M8 12h5M8 15h7" />
      <path d="M4 9h-1M4 15h-1M21 9h-1M21 15h-1" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  pause: <path d="M8.5 5.5v13M15.5 5.5v13" />,
  play: <path d="M8 5.5v13l10-6.5Z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  refresh: (
    <>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <path d="M19.5 4.5V9H15" />
    </>
  ),
  scan: (
    <>
      <path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9" />
      <path d="M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9" />
      <path d="M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15" />
      <path d="M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15" />
      <path d="M4 12h16" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.5 19 6v5.3c0 4.3-2.8 7.4-7 9.2-4.2-1.8-7-4.9-7-9.2V6Z" />
      <path d="m8.8 12 2.1 2.1 4.3-4.3" />
    </>
  ),
  trash: (
    <>
      <path d="M4.5 7h15" />
      <path d="M9 7V4.8h6V7" />
      <path d="m6.5 7 .8 12.2h9.4L17.5 7" />
      <path d="M10 11v4.5M14 11v4.5" />
    </>
  ),
  wallet: (
    <>
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
      <path d="M4 8h14" />
      <path d="M15.5 12.5h4.5v4h-4.5a2 2 0 0 1 0-4Z" />
    </>
  ),
  warning: (
    <>
      <path d="M12 4 21 20H3Z" />
      <path d="M12 9v5" />
      <path d="M12 17v.2" />
    </>
  ),
  x: <path d="m6 6 12 12M18 6 6 18" />,
};

export function Icon({
  name,
  size = 20,
  className,
  strokeWidth = 1.8,
  label,
}: {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
  label?: string;
}): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
