import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Camera, Crop as CropIcon, Image as ImageIcon, ImageMinus, Loader2, Trash2, UserRound } from 'lucide-react';
import { ACCEPTED_IMAGE_TYPES, DEFAULT_GENDER, GENDER_OPTIONS, isGender } from '../constants/profileOptions';
import { PROFILE_NAME_MAX_LENGTH } from '../constants/storageKeys';
import type { Gender, PhotoChange, Profile, ProfileInput } from '../types/gym';
import { toDateKey } from '../utils/dateUtils';
import { useBodyWeight } from '../hooks/useBodyWeight';
import { useToday } from '../hooks/useToday';
import { validateBodyWeight } from '../services/cloud/bodyWeightService';
import {
  MAX_AGE_YEARS,
  MAX_HEIGHT_CM,
  MIN_AGE_YEARS,
  MIN_HEIGHT_CM,
  calculateBmi,
  formatBmi,
  parseAgeInput,
  parseHeightInput,
} from '../utils/profileDetails';
import { formatNumber, parseNumberInput } from '../utils/workoutUtils';
import { validateImageFile } from '../utils/imageUtils';
import { ImageCropper } from './ImageCropper';
import { Modal } from './Modal';
import { ProfileAvatar } from './ProfileAvatar';
import { ProfileLockSettings } from './profileLock/ProfileLockSettings';
import { CardBackgroundEditor } from './cardBackground/CardBackgroundEditor';
import { ProfileCard } from './ProfileCard';
import { useCardBackgrounds } from '../hooks/useCardBackgrounds';
import { DEFAULT_PROFILE_THEME, PROFILE_THEMES } from '../constants/profileThemes';
import { profileTileThemeStyle, setPreviewTheme } from '../services/documentTheme';
import { deriveThemePalette, normalizeHexColor } from '../utils/themeColor';
import type { ProfileThemeKey } from '../types/gym';

interface ProfileModalProps {
  isOpen: boolean;
  /** When provided the modal edits this profile; otherwise it creates a new one. */
  profile: Profile | null;
  onClose: () => void;
  /** Rejects with a user-facing Error if saving fails. */
  onSave: (input: ProfileInput) => Promise<void>;
  /**
   * When provided (edit mode only), a "Delete Profile" danger section is shown.
   * Runs only after an explicit confirmation; rejects with a user-facing Error on failure.
   */
  onDelete?: () => Promise<void>;
  /** Current streak, shown on the card background preview. */
  streakDays?: number;
}

type ModalView = 'form' | 'confirm-delete' | 'background';

export function ProfileModal({ isOpen, profile, onClose, onSave, onDelete, streakDays = 0 }: ProfileModalProps) {
  const { getCardBackground } = useCardBackgrounds();
  const [backgroundNotice, setBackgroundNotice] = useState<string | null>(null);
  const isEditing = profile !== null;
  const inputId = useId();
  const genderId = useId();
  const errorId = useId();
  const startId = useId();
  const photoErrorId = useId();
  const ageId = useId();
  const heightId = useId();
  const weightId = useId();
  const dangerHeadingId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender>(DEFAULT_GENDER);
  /** Image shown in the preview: the saved photo's signed URL, or a newly cropped data URL. */
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  /** True once the picture was replaced or removed in this session. */
  const [photoTouched, setPhotoTouched] = useState(false);
  const [trackingStart, setTrackingStart] = useState(() => toDateKey(new Date()));
  const [ageText, setAgeText] = useState('');
  const [heightText, setHeightText] = useState('');
  const [weightText, setWeightText] = useState('');
  // Weight is not a profile column: it is the latest body_weight_entries row (Edit writes today's entry).
  const todayKey = useToday();
  const { entries: weightEntries, save: saveBodyWeight } = useBodyWeight(profile?.id ?? '');
  const latestWeightKg = weightEntries.length > 0 ? weightEntries[weightEntries.length - 1].weightKg : null;
  const latestWeightRef = useRef(latestWeightKg);
  latestWeightRef.current = latestWeightKg;
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [themeKey, setThemeKey] = useState<ProfileThemeKey>(DEFAULT_PROFILE_THEME);
  /** Exact custom colour (#RRGGBB) or null when a preset is chosen. */
  const [customThemeColor, setCustomThemeColor] = useState<string | null>(null);
  /** Last custom colour picked in this dialog, so the colour input reopens on it. */
  const [lastCustomColor, setLastCustomColor] = useState('#4F46E5');
  const [hexText, setHexText] = useState('');
  const customPalette = useMemo(() => (customThemeColor ? deriveThemePalette(customThemeColor) : null), [customThemeColor]);
  const [view, setView] = useState<ModalView>('form');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
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
      setAgeText(profile?.ageYears != null ? String(profile.ageYears) : '');
      setHeightText(profile?.heightCm != null ? String(profile.heightCm) : '');
      setWeightText(latestWeightRef.current !== null ? formatNumber(Math.round(latestWeightRef.current * 10) / 10) : '');
      setDetailsError(null);
      setThemeKey(profile?.themeKey ?? DEFAULT_PROFILE_THEME);
      setBackgroundNotice(null);
      setCustomThemeColor(profile?.customThemeColor ?? null);
      setLastCustomColor(profile?.customThemeColor ?? '#4F46E5');
      setView('form');
      setDeleting(false);
      setDeleteError(null);
      setSaving(false);
      setCropSource(null);
      setError(null);
      setPhotoError(null);
    } else {
      releaseOriginal();
    }
  }, [isOpen, profile]);

  useEffect(() => releaseOriginal, []);

  // Live theme preview while the dialog is open; closing (Save or Cancel) drops the preview,
  // so the saved theme (or the previous one) is shown again.
  useEffect(() => {
    if (!isOpen) return;
    setPreviewTheme({ themeKey, customThemeColor });
    return () => setPreviewTheme(null);
  }, [isOpen, themeKey, customThemeColor]);

  // Keep the HEX field in step with the colour input (typing a partial value doesn't reset it).
  useEffect(() => {
    if (customThemeColor && normalizeHexColor(hexText) !== customThemeColor) setHexText(customThemeColor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customThemeColor]);

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
    const age = parseAgeInput(ageText);
    const height = parseHeightInput(heightText);
    if (!age.ok) return setDetailsError(age.error);
    if (!height.ok) return setDetailsError(height.error);
    const weightKg = weightText.trim() === '' ? null : parseNumberInput(weightText.replace(',', '.'));
    const shownWeightKg = latestWeightKg === null ? null : Math.round(latestWeightKg * 10) / 10;
    const weightChanged = isEditing && weightKg !== null && weightKg !== shownWeightKg;
    if (isEditing && weightText.trim() !== '') {
      const weightProblem = weightKg === null ? 'Weight must be a number in kg.' : validateBodyWeight(todayKey, weightKg, 'KG');
      if (weightProblem) return setDetailsError(weightProblem);
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
      // Weight first (upsert of today's entry is idempotent, so a retry after a failed profile save is safe).
      if (weightChanged && weightKg !== null) await saveBodyWeight(todayKey, weightKg, 'KG');
      await onSave({ name, gender, trackingStartDate: trackingStart, photo, ageYears: age.value, heightCm: height.value, themeKey, customThemeColor });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const liveHeight = parseHeightInput(heightText);
  const liveBmi = calculateBmi(liveHeight.ok ? liveHeight.value : null, parseNumberInput(weightText.replace(',', '.')));

  const confirmDelete = async () => {
    if (!onDelete || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await onDelete();
    } catch (deleteFailure) {
      setDeleteError(deleteFailure instanceof Error ? deleteFailure.message : 'Could not delete this profile.');
      setDeleting(false);
    }
  };

  const confirmingDelete = view === 'confirm-delete' && isEditing;
  const editingBackground = view === 'background' && isEditing && profile !== null;
  const closeView = cropSource ? () => setCropSource(null) : confirmingDelete || editingBackground ? () => setView('form') : onClose;

  let title = isEditing ? 'Edit profile' : 'New profile';
  let description = isEditing ? 'Update the details for this workout space.' : 'Create a personal space to plan your training week.';
  let icon = <UserRound size={24} aria-hidden="true" />;
  if (cropSource) {
    title = 'Adjust photo';
    description = 'Drag and zoom so your face sits inside the circle.';
    icon = <CropIcon size={24} aria-hidden="true" />;
  } else if (confirmingDelete) {
    title = `Delete “${profile?.name ?? ''}”?`;
    description =
      'This permanently deletes the profile and all of its attendance, workout splits, set plans, daily progress, personal records, body-weight entries and photo on every device. This can’t be undone.';
    icon = <Trash2 size={24} aria-hidden="true" />;
  } else if (editingBackground) {
    title = 'Customize Card Background';
    description = 'This image appears behind this profile’s card on the Profiles page. Your profile picture stays as it is.';
    icon = <ImageIcon size={24} aria-hidden="true" />;
  }

  return (
    <Modal isOpen={isOpen} onClose={closeView} placement="top" title={title} description={description} icon={icon}>
      {editingBackground && profile ? (
        <CardBackgroundEditor
          profileId={profile.id}
          cardKey="profile"
          background={getCardBackground(profile.id, 'profile')}
          renderPreview={(preview) => (
            <ProfileCard
              profile={profile}
              streakDays={streakDays}
              isLocked={false}
              onOpen={() => undefined}
              onEdit={() => undefined}
              background={preview}
              isPreview
            />
          )}
          onDone={(message) => {
            setView('form');
            if (message) setBackgroundNotice(message);
          }}
        />
      ) : confirmingDelete ? (
        <div data-testid="profile-delete-confirm">
          {deleteError && (
            <p className="field__error" role="alert">
              {deleteError}
            </p>
          )}
          <div className="modal__actions">
            <button type="button" className="button button--ghost" onClick={() => setView('form')} disabled={deleting} data-autofocus>
              Cancel
            </button>
            <button
              type="button"
              className="button button--danger"
              onClick={() => void confirmDelete()}
              disabled={deleting}
              data-testid="profile-delete-confirm-button"
            >
              {deleting && <Loader2 size={18} className="spin" aria-hidden="true" />}
              {deleting ? 'Deleting…' : 'Delete Profile'}
            </button>
          </div>
        </div>
      ) : cropSource ? (
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

        <fieldset className="theme-picker" data-testid="theme-picker">
          <legend className="field__label">Colour theme</legend>
          <div className="theme-picker__options" role="radiogroup" aria-label="Colour theme">
            {PROFILE_THEMES.map((theme) => {
              const isSelected = customThemeColor === null && themeKey === theme.key;
              return (
                <button
                  key={theme.key}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  className={`theme-swatch${isSelected ? ' is-selected' : ''}`}
                  data-theme={theme.key}
                  onClick={() => {
                    // Choosing a preset clears the custom colour.
                    setThemeKey(theme.key);
                    setCustomThemeColor(null);
                  }}
                  title={`${theme.label} – ${theme.description}`}
                  data-testid={`theme-${theme.key}`}
                >
                  <span className="theme-swatch__dot" aria-hidden="true" />
                  <span className="theme-swatch__label">{theme.label}</span>
                </button>
              );
            })}
            <label
              className={`theme-swatch theme-swatch--custom${customThemeColor ? ' is-selected' : ''}`}
              data-theme={customThemeColor ? 'custom' : undefined}
              style={profileTileThemeStyle(customThemeColor)}
              title="Custom colour"
            >
              <span className="theme-swatch__dot theme-swatch__dot--custom" aria-hidden="true" />
              <span className="theme-swatch__label">Custom</span>
              <input
                type="color"
                className="theme-swatch__color-input"
                value={customThemeColor ?? lastCustomColor}
                aria-label="Custom colour"
                onChange={(event) => {
                  const next = normalizeHexColor(event.target.value);
                  if (next) {
                    setCustomThemeColor(next);
                    setLastCustomColor(next);
                  }
                }}
                data-testid="theme-custom-input"
              />
            </label>
          </div>
          {customThemeColor && (
            <div className="theme-picker__custom">
              <label className="theme-picker__hex">
                <span>HEX</span>
                <input
                  className="field__input"
                  value={hexText}
                  maxLength={7}
                  spellCheck={false}
                  autoComplete="off"
                  onChange={(event) => {
                    setHexText(event.target.value);
                    const next = normalizeHexColor(event.target.value);
                    if (next) {
                      setCustomThemeColor(next);
                      setLastCustomColor(next);
                    }
                  }}
                  data-testid="theme-custom-hex"
                />
              </label>
              {customPalette?.adjusted && (
                <span className="photo-picker__hint" data-testid="theme-custom-adjusted">
                  Lightened slightly on dark screens so text stays readable.
                </span>
              )}
            </div>
          )}
        </fieldset>

        {isEditing && profile && (
          <section className="card-bg-setting" aria-label="Card background" data-testid="profile-card-background-setting">
            <div className="card-bg-setting__text">
              <span className="field__label">Card background</span>
              <span className="photo-picker__hint">
                {getCardBackground(profile.id, 'profile') ? 'Custom image on the Profiles page card.' : 'Default card design.'}
              </span>
            </div>
            <button
              type="button"
              className="button button--ghost button--compact"
              onClick={() => {
                setBackgroundNotice(null);
                setView('background');
              }}
              disabled={saving}
              data-testid="profile-customize-background"
            >
              <ImageIcon size={16} aria-hidden="true" /> Customize Card Background
            </button>
            {backgroundNotice && (
              <p className="inline-success" role="status" data-testid="profile-background-notice">
                {backgroundNotice}
              </p>
            )}
          </section>
        )}

        <div className="profile-details-row">
          <div className="field">
            <label htmlFor={ageId} className="field__label">
              Age <span className="muted">(optional)</span>
            </label>
            <input
              id={ageId}
              className="field__input"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder={`${MIN_AGE_YEARS}–${MAX_AGE_YEARS}`}
              value={ageText}
              onChange={(event) => {
                setAgeText(event.target.value);
                setDetailsError(null);
              }}
              data-testid="profile-age"
            />
          </div>
          <div className="field">
            <label htmlFor={heightId} className="field__label">
              Height, cm <span className="muted">(optional)</span>
            </label>
            <input
              id={heightId}
              className="field__input"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder={`${MIN_HEIGHT_CM}–${MAX_HEIGHT_CM}`}
              value={heightText}
              onChange={(event) => {
                setHeightText(event.target.value);
                setDetailsError(null);
              }}
              data-testid="profile-height"
            />
          </div>
          {isEditing && (
            <div className="field">
              <label htmlFor={weightId} className="field__label">
                Weight, kg <span className="muted">(today)</span>
              </label>
              <input
                id={weightId}
                className="field__input"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="e.g. 72.5"
                value={weightText}
                onChange={(event) => {
                  setWeightText(event.target.value);
                  setDetailsError(null);
                }}
                data-testid="profile-weight"
              />
            </div>
          )}
          {isEditing && (
            <div className="field">
              <span className="field__label">BMI</span>
              <output className="profile-bmi" htmlFor={`${heightId} ${weightId}`} data-testid="profile-bmi">
                {liveBmi ? formatBmi(liveBmi) : 'Add height and weight'}
              </output>
            </div>
          )}
        </div>
        {isEditing && <span className="photo-picker__hint">A changed weight is saved as today’s body-weight entry and appears in your weight graph.</span>}
        {detailsError && (
          <p className="field__error" role="alert" data-testid="profile-details-error">
            {detailsError}
          </p>
        )}

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
      {isEditing && profile && view === 'form' && !cropSource && <ProfileLockSettings profileId={profile.id} profileName={profile.name} />}
      {isEditing && onDelete && view === 'form' && !cropSource && (
        <section className="danger-zone" aria-labelledby={dangerHeadingId}>
          <h3 id={dangerHeadingId} className="danger-zone__title">
            Danger zone
          </h3>
          <p className="danger-zone__text">Deleting removes this profile and all of its training data from your account.</p>
          <button
            type="button"
            className="button button--ghost button--danger-text danger-zone__button"
            onClick={() => {
              setDeleteError(null);
              setView('confirm-delete');
            }}
            disabled={saving}
            data-testid="profile-delete"
          >
            <Trash2 size={16} aria-hidden="true" /> Delete Profile
          </button>
        </section>
      )}
    </Modal>
  );
}
