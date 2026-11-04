import {
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { Icon } from './Icon';

interface SharedFieldProps {
  label: string;
  hint?: string;
  error?: string;
  mono?: boolean;
  suffix?: ReactNode;
}

type TextFieldProps = SharedFieldProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> & {
    className?: string;
  };

export function TextField({
  label,
  hint,
  error,
  mono = false,
  suffix,
  id,
  className,
  ...rest
}: TextFieldProps): ReactElement {
  const generated = useId();
  const fieldId = id ?? generated;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`field ${error ? 'is-invalid' : ''} ${className ?? ''}`.trim()}>
      <label className="field__label" htmlFor={fieldId}>
        {label}
      </label>
      <div className="field__control">
        <input
          id={fieldId}
          className={`field__input ${mono ? 'mono' : ''}`.trim()}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
        {suffix ? <span className="field__suffix">{suffix}</span> : null}
      </div>
      {hint ? (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="field__error" id={errorId}>
          <Icon name="warning" size={14} />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

type SelectFieldProps = SharedFieldProps &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'> & {
    className?: string;
    children: ReactNode;
  };

export function SelectField({
  label,
  hint,
  error,
  id,
  className,
  children,
  ...rest
}: SelectFieldProps): ReactElement {
  const generated = useId();
  const fieldId = id ?? generated;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`field ${error ? 'is-invalid' : ''} ${className ?? ''}`.trim()}>
      <label className="field__label" htmlFor={fieldId}>
        {label}
      </label>
      <div className="field__control">
        <select
          id={fieldId}
          className="field__input field__select"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        >
          {children}
        </select>
        <Icon name="chevron-down" size={16} className="field__chevron" />
      </div>
      {hint ? (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="field__error" id={errorId}>
          <Icon name="warning" size={14} />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
