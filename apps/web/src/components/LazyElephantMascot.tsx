import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ReactElement,
} from 'react';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { useLang } from '../lib/i18n';
import type { ElephantMascotProps } from './ElephantMascot';
import { MascotFallback } from './MascotFallback';

const LazyMascot = lazy(async () => {
  const module = await import('./ElephantMascot');
  return { default: module.ElephantMascot };
});

/**
 * Keeps the Three.js chunk out of the first paint. The static SVG stands in
 * until the canvas is close to the viewport, and reduced-motion users keep the
 * static version for the whole session.
 */
export function LazyElephantMascot(props: ElephantMascotProps): ReactElement {
  const reducedMotion = usePrefersReducedMotion();
  const { tx } = useLang();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);
  const label =
    props.label ??
    tx('Voxel detective elephant on duty', 'Gajah detektif voxel sedang bertugas');

  useEffect(() => {
    const element = wrapperRef.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '240px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  if (reducedMotion) {
    return <MascotFallback label={label} className={props.className} />;
  }

  return (
    <div ref={wrapperRef} className="mascot-lazy">
      {inView ? (
        <Suspense fallback={<MascotFallback label={label} className={props.className} />}>
          <LazyMascot {...props} label={label} />
        </Suspense>
      ) : (
        <MascotFallback label={label} className={props.className} />
      )}
    </div>
  );
}
