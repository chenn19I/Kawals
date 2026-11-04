import type { ReactElement } from 'react';

/**
 * A static, dependency-free fallback. It is used before the WebGL chunk loads,
 * when the user prefers reduced motion, or when WebGL is unavailable. It must
 * never import Three.js, or the lazy chunk would be pulled into the first paint.
 */
export function MascotFallback({
  label,
  className,
}: {
  label: string;
  className?: string;
}): ReactElement {
  return (
    <div
      className={`mascot-canvas mascot-fallback ${className ?? ''}`.trim()}
      role="img"
      aria-label={label}
    >
      <svg viewBox="0 0 220 260" aria-hidden="true">
        <g stroke="#14122b" strokeWidth="3" strokeLinejoin="round">
          <rect x="55" y="165" width="26" height="50" fill="#7f90c4" />
          <rect x="137" y="165" width="26" height="50" fill="#7f90c4" />
          <rect x="42" y="210" width="46" height="18" fill="#5a3d22" />
          <rect x="132" y="210" width="46" height="18" fill="#5a3d22" />
          <rect x="52" y="112" width="116" height="82" fill="#9fb0d8" />
          <rect x="52" y="164" width="116" height="30" fill="#c8a05a" />
          <rect x="52" y="188" width="116" height="8" fill="#a8803f" />
          <rect x="66" y="66" width="88" height="68" fill="#9fb0d8" />
          <rect x="50" y="83" width="26" height="44" fill="#7f90c4" />
          <rect x="144" y="83" width="26" height="44" fill="#7f90c4" />
          <rect x="80" y="46" width="60" height="24" fill="#d1a45c" />
          <rect x="68" y="65" width="84" height="12" fill="#d1a45c" />
          <rect x="80" y="64" width="60" height="6" fill="#8a6431" />
          <rect x="82" y="94" width="12" height="12" fill="#14122b" stroke="none" />
          <rect x="126" y="94" width="12" height="12" fill="#14122b" stroke="none" />
          <rect x="82" y="96" width="4" height="4" fill="#fff4d6" stroke="none" />
          <rect x="126" y="96" width="4" height="4" fill="#fff4d6" stroke="none" />
          <rect x="96" y="114" width="28" height="10" fill="#14122b" stroke="none" />
          <path d="M104 124v28q0 12 12 12h6" fill="none" strokeWidth="10" stroke="#9fb0d8" />
          <path d="M104 124v28q0 12 12 12h6" fill="none" strokeWidth="3" stroke="#14122b" />
          <circle cx="160" cy="118" r="22" fill="none" strokeWidth="7" stroke="#5a3d22" />
          <circle
            cx="160"
            cy="118"
            r="18"
            fill="#9ff3ff"
            fillOpacity="0.35"
            stroke="#14122b"
            strokeWidth="3"
          />
          <rect
            x="174"
            y="132"
            width="8"
            height="42"
            rx="3"
            transform="rotate(-32 178 153)"
            fill="#5a3d22"
          />
          <rect x="30" y="138" width="18" height="12" fill="#e0402f" />
          <rect x="172" y="138" width="18" height="12" fill="#e0402f" />
        </g>
      </svg>
    </div>
  );
}
