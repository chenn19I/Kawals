import { useEffect, useId, useRef, type ReactElement, type ReactNode } from 'react';
import { useLang } from '../lib/i18n';
import { Icon } from './Icon';
import { Button } from './Button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
  children?: ReactNode;
}

/**
 * A small focus-trapped dialog. Cancel receives the first focus on purpose:
 * destructive actions and "continue anyway" actions should require a move.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  destructive = false,
  children,
}: ConfirmDialogProps): ReactElement | null {
  const { tx } = useLang();
  const titleId = useId();
  const messageId = useId();
  const bodyId = useId();
  const describedBy = [message ? messageId : null, children ? bodyId : null]
    .filter(Boolean)
    .join(' ');
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(() => cancelRef.current?.focus(), 30);

    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== 'Tab') return;
      const sheet = sheetRef.current;
      if (!sheet) return;
      const focusable = [
        ...sheet.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      restoreRef.current?.focus();
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="confirm-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        className={`confirm-sheet ${destructive ? 'is-danger' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedBy || undefined}
        ref={sheetRef}
      >
        <div className="confirm-sheet__head">
          <span className={`confirm-sheet__icon ${destructive ? 'is-danger' : ''}`} aria-hidden="true">
            <Icon name={destructive ? 'warning' : 'info'} size={20} />
          </span>
          <span className="mono confirm-sheet__code">
            {destructive ? tx('DESTRUCTIVE', 'MERUSAK') : tx('CONFIRM', 'KONFIRMASI')}
          </span>
        </div>
        <h2 id={titleId}>{title}</h2>
        {message ? (
          <p className="confirm-sheet__message" id={messageId}>
            {message}
          </p>
        ) : null}
        {children ? (
          <div className="confirm-sheet__body" id={bodyId}>
            {children}
          </div>
        ) : null}
        <div className="confirm-sheet__foot">
          <Button
            variant="quiet"
            size="sm"
            ref={cancelRef}
            onClick={onCancel}
          >
            {cancelLabel ?? tx('Cancel', 'Batal')}
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            size="sm"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
