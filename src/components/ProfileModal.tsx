import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Camera, ImageMinus, Loader2, UserRound } from 'lucide-react';
import { ACCEPTED_IMAGE_TYPES, DEFAULT_GENDER, GENDER_OPTIONS, isGender } from '../constants/profileOptions';
import { PROFILE_NAME_MAX_LENGTH } from '../constants/storageKeys';
import type { Gender, Profile, ProfileInput } from '../types/gym';
import { processProfileImage } from '../utils/imageUtils';
import { Modal } from './Modal';
import { ProfileAvatar } from './ProfileAvatar';

interface ProfileModalProps {
  isOpen: boolean;
  /** When provided the modal edits this profile; otherwise it creates a new one. */
  profile: Profile | null;
  onClose: () => void;
  /** Should throw an Error with a user-facing message if saving fails. */
  onSave: (input: ProfileInput) => void;
}

export function ProfileModal({ isOpen, profile, onClose, onSave }: ProfileModalProps) {
  const isEditing = profile !== null;
  const inputId = useId();
  const genderId = useId();
  const errorId = useId();
  const photoErrorId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender>(DEFAULT_GENDER);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(profile?.name ?? '');
      setGender(profile?.gender ?? DEFAULT_GENDER);
      setPhotoDataUrl(profile?.photoDataUrl ?? null);
      setIsProcessingPhoto(false);
      setError(null);
      setPhotoError(null);
    }
  }, [isOpen, profile]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow re-selecting the same file later
    if (!file) return;

    setPhotoError(null);
    setIsProcessingPhoto(true);
    try {
      setPhotoDataUrl(await processProfileImage(file));
    } catch (processingError) {
      setPhotoError(processingError instanceof Error ? processingError.message : 'This image couldn’t be used.');
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isProcessingPhoto) return;
    if (!name.trim()) {
      setError('Please enter a profile name.');
      return;
    }
    try {
      onSave({ name, gender, photoDataUrl });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Something went wrong. Please try again.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit profile' : 'New profile'}
      description={
        isEditing ? 'Update the details for this workout space.' : 'Create a personal space to plan your training week.'
      }
      icon={<UserRound size={24} aria-hidden="true" />}
    >
      <form className="form" onSubmit={handleSubmit} noValidate>
        <div className="photo-picker">
          <div className="photo-picker__preview" aria-busy={isProcessingPhoto}>
            {photoDataUrl || name.trim() ? (
              <ProfileAvatar seed={profile?.id ?? 'new-profile'} name={name || '?'} photoDataUrl={photoDataUrl} size={88} />
            ) : (
              <span className="photo-picker__placeholder" aria-hidden="true">
                <UserRound size={36} />
              </span>
            )}
            {isProcessingPhoto && (
              <span className="photo-picker__busy" aria-hidden="true">
                <Loader2 size={24} className="spin" />
              </span>
            )}
          </div>
          <div className="photo-picker__body">
            <span className="field__label">Profile picture</span>
            <div className="photo-picker__actions">
              <button
                type="button"
                className="button button--ghost button--compact"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingPhoto}
                aria-describedby={photoError ? photoErrorId : undefined}
              >
                <Camera size={16} aria-hidden="true" />
                {photoDataUrl ? 'Change' : 'Upload'}
              </button>
              {photoDataUrl && (
                <button
                  type="button"
                  className="button button--ghost button--compact button--danger-text"
                  onClick={() => {
                    setPhotoDataUrl(null);
                    setPhotoError(null);
                  }}
                  disabled={isProcessingPhoto}
                >
                  <ImageMinus size={16} aria-hidden="true" />
                  Remove
                </button>
              )}
            </div>
            <span className="photo-picker__hint">JPG, PNG or WebP</span>
            <input
              ref={fileInputRef}
              className="visually-hidden"
              type="file"
              accept={ACCEPTED_IMAGE_TYPES.join(',')}
              onChange={handleFileChange}
              tabIndex={-1}
              aria-label="Upload profile picture"
              data-testid="photo-input"
            />
          </div>
        </div>
        {photoError && (
          <p id={photoErrorId} className="field__error photo-picker__error" role="alert">
            {photoError}
          </p>
        )}

        <div className="field">
          <label htmlFor={inputId} className="field__label">
            Profile name
          </label>
          <input
            id={inputId}
            data-autofocus
            className={`field__input${error ? ' field__input--invalid' : ''}`}
            type="text"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (error) setError(null);
            }}
            placeholder="e.g. Alex"
            maxLength={PROFILE_NAME_MAX_LENGTH + 10}
            autoComplete="off"
            enterKeyHint="done"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
          />
          <div className="field__meta">
            {error ? (
              <p id={errorId} className="field__error" role="alert">
                {error}
              </p>
            ) : (
              <span />
            )}
            <span className="field__count" aria-hidden="true">
              {name.trim().length}/{PROFILE_NAME_MAX_LENGTH}
            </span>
          </div>
        </div>

        <div className="field">
          <label htmlFor={genderId} className="field__label">
            Gender
          </label>
          <div className="select-wrapper">
            <select
              id={genderId}
              className="field__input field__select"
              value={gender}
              onChange={(event) => {
                if (isGender(event.target.value)) setGender(event.target.value);
              }}
            >
              {GENDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="modal__actions">
          <button type="button" className="button button--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button button--primary" disabled={isProcessingPhoto}>
            {isEditing ? 'Save changes' : 'Save profile'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
