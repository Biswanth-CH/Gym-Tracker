import { useState, type ReactNode } from 'react';
import { Images, Loader2, Trash2 } from 'lucide-react';
import { errorMessage } from '../../services/cloud/cloudErrors';
import type { CardBackgroundSettings } from '../../types/gym';
import {
  DEFAULT_CARD_BACKGROUND_SETTINGS,
  MAX_BLUR_PX,
  MAX_DIM_PERCENT,
  MAX_ZOOM_PERCENT,
  MIN_ZOOM_PERCENT,
  backgroundSettingsSummary,
  normalizeBackgroundSettings,
} from '../../utils/cardBackground';
import { BackgroundGallery } from './BackgroundGallery';

/** What the live preview should show (null = the card's normal design). */
export interface CardBackgroundPreview {
  imageUrl: string;
  settings: CardBackgroundSettings;
}

interface CardBackgroundEditorProps {
  /** The profile using the editor (gallery uploads belong to it; it may delete only its own uploads). */
  actingProfileId: string;
  /** The current background (null when the card has none). */
  background: { storagePath: string; imageUrl: string | null; settings: CardBackgroundSettings } | null;
  /** Renders the real card with the draft background, for the live preview. */
  renderPreview: (preview: CardBackgroundPreview | null) => ReactNode;
  /** Save: the chosen gallery image (path + preview URL) and the settings. Throw to show an error. */
  onSave: (image: { storagePath: string; imageUrl: string | null }, settings: CardBackgroundSettings) => Promise<void>;
  /** Remove the background from this card (the image stays in the gallery). Throw to show an error. */
  onRemove: () => Promise<void>;
  onCancel: () => void;
  /** "Save" for direct saves; "Apply" for split drafts. */
  saveLabel?: string;
  /** A gallery image was deleted (every saved card using it is already reset). */
  onImageDeleted?: (storagePath: string) => void;
}

type Stage = 'idle' | 'saving' | 'removing';

/**
 * "Edit Background": choose an image from the shared gallery (or upload one there), adjust
 * dim / blur / zoom / position with a live preview, then Save, Cancel or Remove Background.
 * The settings summary is shown only here (never on the cards themselves).
 */
export function CardBackgroundEditor({ actingProfileId, background, renderPreview, onSave, onRemove, onCancel, saveLabel = 'Save', onImageDeleted }: CardBackgroundEditorProps) {
  const [settings, setSettings] = useState<CardBackgroundSettings>(() => (background ? normalizeBackgroundSettings(background.settings) : DEFAULT_CARD_BACKGROUND_SETTINGS));
  const [chosen, setChosen] = useState<{ storagePath: string; imageUrl: string | null } | null>(background ? { storagePath: background.storagePath, imageUrl: background.imageUrl } : null);
  const [galleryOpen, setGalleryOpen] = useState(!background);
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const busy = stage !== 'idle';

  const previewUrl = chosen?.imageUrl ?? null;
  const preview: CardBackgroundPreview | null = previewUrl ? { imageUrl: previewUrl, settings } : null;

  const save = async () => {
    if (!chosen) return setError('Choose an image first.');
    setError(null);
    setStage('saving');
    try {
      await onSave(chosen, settings);
    } catch (saveError) {
      setError(errorMessage(saveError, 'Could not save the card background.'));
      setStage('idle');
    }
  };

  const remove = async () => {
    if (!background) {
      setChosen(null);
      setConfirmingRemove(false);
      return;
    }
    setError(null);
    setStage('removing');
    try {
      await onRemove();
    } catch (removeError) {
      setError(errorMessage(removeError, 'Could not remove the card background.'));
      setStage('idle');
      setConfirmingRemove(false);
    }
  };

  const slider = (key: keyof CardBackgroundSettings, label: string, max: number, unit: string, testId: string, min = 0, step = 1) => (
    <label className="bg-slider">
      <span className="bg-slider__label">
        {label} <span className="bg-slider__value">{settings[key]}{unit}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={settings[key]}
        disabled={!chosen || busy}
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
      {chosen && (
        <p className="bg-editor__summary" data-testid="card-bg-summary">
          {backgroundSettingsSummary(settings)}
        </p>
      )}

      <div className="bg-editor__upload">
        <button
          type="button"
          className="button button--ghost button--compact"
          aria-expanded={galleryOpen}
          onClick={() => setGalleryOpen((open) => !open)}
          disabled={busy}
          data-testid="card-bg-choose"
        >
          <Images size={16} aria-hidden="true" /> {chosen ? 'Replace Image' : 'Choose Image'}
        </button>
      </div>
      {galleryOpen && (
        <BackgroundGallery
          actingProfileId={actingProfileId}
          selectedPath={chosen?.storagePath ?? null}
          onSelect={(image) => {
            // A newly chosen image starts from the defaults only when the card had none.
            if (!chosen) setSettings(DEFAULT_CARD_BACKGROUND_SETTINGS);
            setChosen(image);
            setError(null);
          }}
          onDeleted={(storagePath) => {
            // The deleted image can't be used any more: this card goes back to its default look.
            if (chosen?.storagePath === storagePath) setChosen(null);
            onImageDeleted?.(storagePath);
          }}
        />
      )}

      {slider('dimPercent', 'Dim', MAX_DIM_PERCENT, '%', 'card-bg-dim')}
      {slider('blurPx', 'Blur', MAX_BLUR_PX, 'px', 'card-bg-blur')}
      {slider('zoomPercent', 'Zoom', MAX_ZOOM_PERCENT, '%', 'card-bg-zoom', MIN_ZOOM_PERCENT, 5)}
      <div className="bg-editor__focal">
        {slider('focalX', 'Position ↔', 100, '%', 'card-bg-focal-x')}
        {slider('focalY', 'Position ↕', 100, '%', 'card-bg-focal-y')}
      </div>

      {busy && (
        <p className="bg-editor__status" role="status" data-testid="card-bg-status">
          <Loader2 size={16} className="spin" aria-hidden="true" /> {stage === 'removing' ? 'Removing…' : 'Saving…'}
        </p>
      )}
      {error && (
        <p className="field__error" role="alert" data-testid="card-bg-error">
          {error}
        </p>
      )}

      {confirmingRemove ? (
        <div className="bg-editor__confirm" role="alert" data-testid="card-bg-remove-confirm">
          <p>Remove this background? The card goes back to its normal look. The image stays in the gallery.</p>
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
          {chosen && (
            <button type="button" className="button button--ghost button--danger-text" onClick={() => setConfirmingRemove(true)} disabled={busy} data-testid="card-bg-remove">
              <Trash2 size={16} aria-hidden="true" /> Remove Background
            </button>
          )}
          <button type="button" className="button button--ghost" onClick={onCancel} disabled={busy} data-testid="card-bg-cancel">
            Cancel
          </button>
          <button type="button" className="button button--primary" onClick={() => void save()} disabled={busy || !chosen} data-testid="card-bg-save">
            {saveLabel}
          </button>
        </div>
      )}
    </div>
  );
}
