import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { ACCEPTED_IMAGE_TYPES } from '../../constants/profileOptions';
import { useCloudSlice } from '../../hooks/useCloud';
import { cardBackgroundService } from '../../services/cloud/cardBackgroundService';
import { errorMessage } from '../../services/cloud/cloudErrors';
import type { CardBackground, CardBackgroundKey, CardBackgroundSettings } from '../../types/gym';
import {
  DEFAULT_CARD_BACKGROUND_SETTINGS,
  MAX_BACKGROUND_BYTES,
  MAX_BACKGROUND_DIMENSION,
  MAX_BLUR_PX,
  MAX_DIM_PERCENT,
  normalizeBackgroundSettings,
} from '../../utils/cardBackground';
import { compressBackgroundImage } from '../../utils/imageUtils';

/** What the live preview should show (null = the card's normal design). */
export interface CardBackgroundPreview {
  imageUrl: string;
  settings: CardBackgroundSettings;
}

interface CardBackgroundEditorProps {
  profileId: string;
  cardKey: CardBackgroundKey;
  /** The saved background (null when the card has none). */
  background: CardBackground | null;
  /** Renders the real card with the draft background, for the live preview. */
  renderPreview: (preview: CardBackgroundPreview | null) => ReactNode;
  /** Called after Save / Remove succeeded (with a toast message) or on Cancel (null). */
  onDone: (message: string | null) => void;
}

type Stage = 'idle' | 'compressing' | 'uploading' | 'removing';

const STAGE_LABEL: Record<Stage, string> = {
  idle: '',
  compressing: 'Preparing image…',
  uploading: 'Uploading and saving…',
  removing: 'Removing…',
};

/**
 * "Customize Card Background": pick an image (compressed in the browser before upload),
 * adjust dim / blur / focal point with a live preview, then Save, Cancel (restores the
 * saved state — nothing is uploaded until Save) or Remove Background.
 */
export function CardBackgroundEditor({ profileId, cardKey, background, renderPreview, onDone }: CardBackgroundEditorProps) {
  const userId = useCloudSlice((snapshot) => snapshot.userId);
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [settings, setSettings] = useState<CardBackgroundSettings>(() => (background ? normalizeBackgroundSettings(background) : DEFAULT_CARD_BACKGROUND_SETTINGS));
  const [newImage, setNewImage] = useState<Blob | null>(null);
  const [newImageUrl, setNewImageUrl] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const busy = stage !== 'idle';

  // Release the local preview URL when it changes or the editor closes.
  useEffect(() => () => {
    if (newImageUrl) URL.revokeObjectURL(newImageUrl);
  }, [newImageUrl]);

  const previewUrl = newImageUrl ?? background?.imageUrl ?? null;
  const preview: CardBackgroundPreview | null = previewUrl ? { imageUrl: previewUrl, settings } : null;

  const chooseFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setStage('compressing');
    try {
      const blob = await compressBackgroundImage(file, MAX_BACKGROUND_DIMENSION, MAX_BACKGROUND_BYTES);
      setNewImage(blob);
      setNewImageUrl(URL.createObjectURL(blob));
      // A brand-new image starts with the sensible defaults (dim 45 %, no blur, centred).
      if (!background) setSettings(DEFAULT_CARD_BACKGROUND_SETTINGS);
    } catch (chooseError) {
      setError(errorMessage(chooseError, 'This image could not be used.'));
    } finally {
      setStage('idle');
    }
  };

  const save = async () => {
    if (!userId) return setError('You are signed out. Please sign in again.');
    if (!newImage && !background) return setError('Choose an image first.');
    setError(null);
    setStage('uploading');
    try {
      await cardBackgroundService.save({ userId, profileId, cardKey, newImage, settings, existing: background });
      onDone('Card background saved');
    } catch (saveError) {
      setError(errorMessage(saveError, 'Could not save the card background.'));
      setStage('idle');
    }
  };

  const remove = async () => {
    if (!background) {
      // Only a not-yet-saved image: just drop it.
      setNewImage(null);
      setNewImageUrl(null);
      setConfirmingRemove(false);
      return;
    }
    setError(null);
    setStage('removing');
    try {
      await cardBackgroundService.remove(background);
      onDone('Card background removed');
    } catch (removeError) {
      setError(errorMessage(removeError, 'Could not remove the card background.'));
      setStage('idle');
      setConfirmingRemove(false);
    }
  };

  const slider = (key: keyof CardBackgroundSettings, label: string, max: number, unit: string, testId: string) => (
    <label className="bg-slider">
      <span className="bg-slider__label">
        {label} <span className="bg-slider__value">{settings[key]}{unit}</span>
      </span>
      <input
        type="range"
        min={0}
        max={max}
        step={1}
        value={settings[key]}
        disabled={!preview || busy}
        onChange={(event) => setSettings((current) => normalizeBackgroundSettings({ ...current, [key]: event.target.value }))}
        data-testid={testId}
      />
    </label>
  );

  return (
    <div className="bg-editor" data-testid="card-background-editor">
      <div className="bg-editor__preview" data-testid="card-background-preview">
        {renderPreview(preview)}
      </div>

      <div className="bg-editor__upload">
        <button type="button" className="button button--ghost button--compact" onClick={() => fileInputRef.current?.click()} disabled={busy} data-testid="card-bg-choose">
          <ImagePlus size={16} aria-hidden="true" /> {previewUrl ? 'Replace Image' : 'Upload Image'}
        </button>
        <input
          id={inputId}
          ref={fileInputRef}
          className="visually-hidden"
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(',')}
          tabIndex={-1}
          aria-label="Choose a background image"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            void chooseFile(file);
          }}
          data-testid="card-bg-file"
        />
        <span className="photo-picker__hint">JPG, PNG or WebP · large photos are resized before upload</span>
      </div>

      {slider('dimPercent', 'Dim', MAX_DIM_PERCENT, '%', 'card-bg-dim')}
      {slider('blurPx', 'Blur', MAX_BLUR_PX, 'px', 'card-bg-blur')}
      <div className="bg-editor__focal">
        {slider('focalX', 'Position ↔', 100, '%', 'card-bg-focal-x')}
        {slider('focalY', 'Position ↕', 100, '%', 'card-bg-focal-y')}
      </div>

      {busy && (
        <p className="bg-editor__status" role="status" data-testid="card-bg-status">
          <Loader2 size={16} className="spin" aria-hidden="true" /> {STAGE_LABEL[stage]}
        </p>
      )}
      {error && (
        <p className="field__error" role="alert" data-testid="card-bg-error">
          {error}
        </p>
      )}

      {confirmingRemove ? (
        <div className="bg-editor__confirm" role="alert" data-testid="card-bg-remove-confirm">
          <p>Remove this background? The card goes back to its normal look.</p>
          <div className="modal__actions">
            <button type="button" className="button button--ghost" onClick={() => setConfirmingRemove(false)} disabled={busy}>
              Keep it
            </button>
            <button type="button" className="button button--danger" onClick={() => void remove()} disabled={busy} data-testid="card-bg-remove-confirm-button">
              Remove Background
            </button>
          </div>
        </div>
      ) : (
        <div className="modal__actions bg-editor__actions">
          {previewUrl && (
            <button type="button" className="button button--ghost button--danger-text" onClick={() => setConfirmingRemove(true)} disabled={busy} data-testid="card-bg-remove">
              <Trash2 size={16} aria-hidden="true" /> Remove Background
            </button>
          )}
          <button type="button" className="button button--ghost" onClick={() => onDone(null)} disabled={busy} data-testid="card-bg-cancel">
            Cancel
          </button>
          <button type="button" className="button button--primary" onClick={() => void save()} disabled={busy || !previewUrl} data-testid="card-bg-save">
            Save
          </button>
        </div>
      )}
    </div>
  );
}
