import { ArrowLeft } from 'lucide-react';

interface BackButtonProps {
  label: string;
  onClick: () => void;
}

export function BackButton({ label, onClick }: BackButtonProps) {
  return (
    <button type="button" className="back-button" onClick={onClick}>
      <ArrowLeft size={20} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
