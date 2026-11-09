import { useId } from 'react';
import { PIN_LENGTH } from '../../services/cloud/profilePinService';

interface PinInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  testId?: string;
  autoFocus?: boolean;
}

/** Mobile-friendly 4-digit PIN field (numeric keypad, digits only, masked). Never persisted. */
export function PinInput({ label, value, onChange, testId, autoFocus = false }: PinInputProps) {
  const inputId = useId();
  return (
    <div className="field pin-field">
      <label htmlFor={inputId} className="field__label">
        {label}
      </label>
      <input
        id={inputId}
        className="field__input pin-field__input"
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        maxLength={PIN_LENGTH}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH))}
        data-autofocus={autoFocus ? true : undefined}
        data-testid={testId}
      />
    </div>
  );
}
