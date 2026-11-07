import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Camera, Crop as CropIcon, ImageMinus, Loader2, UserRound } from 'lucide-react';
import { ACCEPTED_IMAGE_TYPES, DEFAULT_GENDER, GENDER_OPTIONS, isGender } from '../constants/profileOptions';
import { PROFILE_NAME_MAX_LENGTH } from '../constants/storageKeys';
import type { Gender, PhotoChange, Profile, ProfileInput } from '../types/gym';
import { toDateKey } from '../utils/dateUtils';
import { validateImageFile } from '../utils/imageUtils';
import { ImageCropper } from './ImageCropper';
import { Modal } from './Modal';
import { ProfileAvatar } from './ProfileAvatar';

interface ProfileModalProps {
  isOpen: boolean;
  /** When provided the modal edits this profile; otherwise it creates a new one. */
  profile: Profile | null;
  onClose: () => void;
  /** Rejects with a user-facing Error if saving fails. */
  onSave: (input: ProfileInput) => Promise<void>;
}

export function ProfileModal({ isOpen, profile, onClose, onSave }: ProfileModalProps) {
  const isEditing = profile !== null;
  const inputId = useId();
  const genderId = useId();
  const errorId = useId();
  const startId = useId();
  const photoErrorId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender>(DEFAULT_GENDER);
  /** Image shown in the preview: the saved photo's signed URL, or a newly cropped data URL. */
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  /** True once the picture was replaced or removed in this session. */
  const [photoTouched, setPhotoTouched] = useState(false);
  const [trackingStart, setTrackingStart] = useState(() => toDateKey(new Date()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  /** Image currently being cropped (object URL of the upload, or the saved avatar). */
  const [cropSource, setCropSource] = useState<string | null>(null);
  /** Object URL of the latest upload in this session, so "Adjust" can re-crop from the original. Never stored. */
  const originalUrlRef = useRef<string | null>(null);
  const isProcessingPhoto = cropSource !== null;

  const releaseOriginal = () => {
    if (originalUrlRef.current) URL.revokeObjectURL(originalUrlRef.current);
    originalUrlRef.current = null;
  };

  useEffect(() => {
    if (isOpen) {
      setName(profile?.name ?? '');
      setGender(profile?.gender ?? DEFAULT_GENDER);
      setPhotoDataUrl(profile?.photoUrl ?? null);
      setPhotoTouched(false);
      setTrackingStart(profile?.trackingStartDate ?? toDateKey(new Date()));
      setSaving(false);
      setCropSource(null);
      setError(null);
      setPhotoError(null);
    } else {
      releaseOriginal();
    }
  }, [isOpen, profile]);

  useEffect(() => releaseOriginal, []);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow re-selecting the same file later
    if (!file) return;

    const validationError = validateImageFile(file);
    if (validationError) {
      setPhotoError(validationError);
      return;
    }
    setPhotoError(null);
    releaseOriginal();
    originalUrlRef.current = URL.createObjectURL(file);
    setCropSource(originalUrlRef.current);
  };

  const handleCropError = (message: string) => {
    setCropSource(null);
    setPhotoError(message);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isProcessingPhoto || saving) return;
    if (!name.trim()) {
      setError('Please enter a profile name.');
      return;
    }
    const photo: PhotoChange = !photoTouched
      ? { kind: 'keep' }
      : photoDataUrl && photoDataUrl.startsWith('data:')
        ? { kind: 'replace', dataUrl: photoDataUrl }
        : photoDataUrl
          ? { kind: 'keep' }
          : { kind: 'remove' };
    setSaving(true);
    setError(null);
    try {
      await onSave({ name, gender, trackingStartDate: trackingStart, photo });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={cropSource ? () => setCropSource(null) : onClose}
      placement="top"
      title={cropSource ? 'Adjust photo' : isEditing ? 'Edit profile' : 'New profile'}
      description={
        cropSource
          ? 'Drag and zoom so your face sits inside the circle.'
          : isEditing
            ? 'Update the details for this workout space.'
            : 'Create a personal space to plan your training week.'
      }
      icon={cropSource ? <CropIcon size={24} aria-hidden="true" /> : <UserRound size={24} aria-hidden="true" />}
    >
      {cropSource ? (
        <ImageCropper
          sourceUrl={cropSource}
          onCancel={() => setCropSource(null)}
          onConfirm={(dataUrl) => {
            setPhotoDataUrl(dataUrl);
            setPhotoTouched(true);
            setCropSource(null);
          }}
          onError={handleCropError}
        />
      ) : (
      <form className="form" onSubmit={handleSubmit} noValidate>
        <div className="photo-picker">
          <div className="photo-picker__preview" aria-busy={isProcessingPhoto}>
            {photoDataUrl || name.trim() ? (
              <ProfileAvatar seed={profile?.id ?? 'new-profile'} name={name || '?'} photoUrl={photoDataUrl} size={88} />
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
                  className="button button--ghost button--compact"
                  onClick={() => setCropSource(originalUrlRef.current ?? photoDataUrl)}
                >
                  <CropIcon size={16} aria-hidden="true" />
                  Adjust
                </button>
              )}
              {photoDataUrl && (
                <button
                  type="button"
                  className="button button--ghost button--compact button--danger-text"
                  onClick={() => {
                    setPhotoDataUrl(null);
                    setPhotoTouched(true);
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

        <div className="field">
          <label htmlFor={startId} className="field__label">
            Tracking start date
          </label>
          <input
            id={startId}
            className="field__input"
            type="date"
            value={trackingStart}
            max={toDateKey(new Date())}
            onChange={(event) => event.target.value && setTrackingStart(event.target.value)}
            data-testid="profile-tracking-start"
          />
          <span className="photo-picker__hint">Attendance and consistency are counted from this date. Set it earlier to log past gym days.</span>
        </div>

        <div className="modal__actions">
          <button type="button" className="button button--ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="button button--primary" disabled={isProcessingPhoto || saving} data-testid="profile-save">
            {saving && <Loader2 size={18} className="spin" aria-hidden="true" />}
            {saving ? 'Saving…' : isEditing ? 'Save changes' : 'Save profile'}
          </button>
        </div>
      </form>
      )}
    </Modal>
  );
}
