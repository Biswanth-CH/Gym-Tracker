import type { CSSProperties } from 'react';
import { getAvatarGradient, getInitials } from '../utils/profileUtils';

interface ProfileAvatarProps {
  /** Used for the deterministic gradient behind initials. */
  seed: string;
  name: string;
  photoDataUrl?: string | null;
  size: number;
  className?: string;
}

/** Circular profile picture, or styled initials when there is no picture. */
export function ProfileAvatar({ seed, name, photoDataUrl, size, className = '' }: ProfileAvatarProps) {
  const style: CSSProperties = {
    width: size,
    height: size,
    fontSize: Math.max(10, Math.round(size * 0.36)),
  };

  if (photoDataUrl) {
    return (
      <img
        className={`avatar avatar--photo ${className}`}
        src={photoDataUrl}
        alt=""
        width={size}
        height={size}
        style={style}
        aria-hidden="true"
      />
    );
  }

  return (
    <span
      className={`avatar ${className}`}
      style={{ ...style, background: getAvatarGradient(seed) }}
      aria-hidden="true"
    >
      {getInitials(name)}
    </span>
  );
}
