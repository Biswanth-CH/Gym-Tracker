import { useEffect, useId, useState } from 'react';
import { Check, Copy, ExternalLink, Globe, Instagram, Loader2, Pencil, PlayCircle, Plus, Trash2, Video, Youtube } from 'lucide-react';
import { BackButton } from '../components/BackButton';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { Toast } from '../components/Toast';
import { getEquipmentNames } from '../constants/gymEquipment';
import { useFormVideos } from '../hooks/useFormVideos';
import { useToast } from '../hooks/useToast';
import { errorMessage } from '../services/cloud/cloudErrors';
import type { ExerciseFormVideo, ExerciseFormVideoInput, FormVideoPlatform, LibraryExercise, MuscleGroup, MuscleRegion, Profile } from '../types/gym';
import {
  FORM_VIDEO_PLATFORMS,
  VIDEO_NAME_MAX_LENGTH,
  detectVideoPlatform,
  parseVideoUrl,
  readableUrl,
  validateVideoName,
  videoPreviewFor,
} from '../utils/formVideoLinks';

interface ExerciseFormVideosPageProps {
  profile: Profile;
  group: MuscleGroup;
  region: MuscleRegion;
  exercise: LibraryExercise;
  onBack: () => void;
}

const PLATFORM_ICON = { YOUTUBE: Youtube, INSTAGRAM: Instagram, OTHER: Globe } as const;
const PLATFORM_LABEL: Record<FormVideoPlatform, string> = { YOUTUBE: 'YouTube', INSTAGRAM: 'Instagram', OTHER: 'Link' };

/** Copies text, falling back to a hidden textarea where the async Clipboard API is unavailable. */
async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  const copied = document.execCommand('copy');
  area.remove();
  if (!copied) throw new Error('Copy is not available in this browser.');
}

/** Form reference videos for ONE exercise variation of the active profile (saved in Supabase). */
export function ExerciseFormVideosPage({ profile, group, region, exercise, onBack }: ExerciseFormVideosPageProps) {
  const { videos, isLoading, addVideo, updateVideo, deleteVideo } = useFormVideos(profile.id, exercise.id);
  const { toast, showToast } = useToast();
  const [editor, setEditor] = useState<{ isOpen: false } | { isOpen: true; video: ExerciseFormVideo | null }>({ isOpen: false });
  const [videoPendingDelete, setVideoPendingDelete] = useState<ExerciseFormVideo | null>(null);
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!videoPendingDelete) return;
    setDeleting(true);
    try {
      await deleteVideo(videoPendingDelete.id);
      showToast(`Deleted “${videoPendingDelete.videoName}”`, 'info');
      setVideoPendingDelete(null);
    } catch (error) {
      showToast(errorMessage(error, 'Could not delete the video.'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="page page--wide form-videos" data-testid="form-videos-page">
      <nav className="top-bar" aria-label="Page navigation">
        <BackButton label={exercise.name} onClick={onBack} />
      </nav>

      <header className="dashboard-header">
        <p className="eyebrow">
          {group.name} · {region.name}
        </p>
        <h1 className="page-title">Form videos</h1>
        <p className="form-videos__exercise" data-testid="form-videos-exercise">
          <strong>{exercise.name}</strong>
          <span className="muted"> · {getEquipmentNames(exercise.equipment).join(', ')}</span>
        </p>
      </header>

      <button type="button" className="button button--primary form-videos__add" onClick={() => setEditor({ isOpen: true, video: null })} data-testid="form-video-add">
        <Plus size={18} aria-hidden="true" /> Add Form Video
      </button>

      {isLoading ? (
        <p className="loading-label" role="status">
          <Loader2 size={16} className="spin" aria-hidden="true" /> Loading videos…
        </p>
      ) : videos.length === 0 ? (
        <EmptyState
          icon={<Video size={28} aria-hidden="true" />}
          title="No form videos yet"
          message="Save YouTube, Instagram or other links that show good form for this variation. They stay with this profile on every device."
        />
      ) : (
        <ul className="form-video-list" data-testid="form-video-list">
          {videos.map((video) => (
            <li key={video.id}>
              <FormVideoCard
                video={video}
                onEdit={() => setEditor({ isOpen: true, video })}
                onDelete={() => setVideoPendingDelete(video)}
                onCopy={async () => {
                  try {
                    await copyToClipboard(video.videoUrl);
                    showToast('Link copied');
                  } catch (error) {
                    showToast(errorMessage(error, 'Could not copy the link.'), 'error');
                  }
                }}
              />
            </li>
          ))}
        </ul>
      )}

      <FormVideoEditor
        isOpen={editor.isOpen}
        video={editor.isOpen ? editor.video : null}
        onClose={() => setEditor({ isOpen: false })}
        onSave={async (input) => {
          if (editor.isOpen && editor.video) {
            await updateVideo(editor.video, input);
            showToast('Video updated');
          } else {
            await addVideo(input);
            showToast('Video saved');
          }
          setEditor({ isOpen: false });
        }}
      />
      <ConfirmDialog
        isOpen={videoPendingDelete !== null}
        title="Delete this video?"
        description={`“${videoPendingDelete?.videoName ?? ''}” will be removed from this variation on every device. The video itself stays on its website.`}
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        icon={<Trash2 size={24} aria-hidden="true" />}
        destructive
        onCancel={() => setVideoPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
      <Toast toast={toast} />
    </div>
  );
}

function FormVideoCard({ video, onEdit, onDelete, onCopy }: { video: ExerciseFormVideo; onEdit: () => void; onDelete: () => void; onCopy: () => void }) {
  const PlatformIcon = PLATFORM_ICON[video.platform];
  const preview = videoPreviewFor(video.videoUrl, video.platform);
  // Instagram embeds are loaded only on request (they are heavier and not always available).
  const [showInstagramPreview, setShowInstagramPreview] = useState(false);

  return (
    <article className="form-video-card" data-platform={video.platform} data-testid="form-video-card">
      <div className="form-video-card__head">
        <span className={`form-video-card__icon form-video-card__icon--${video.platform.toLowerCase()}`} aria-label={PLATFORM_LABEL[video.platform]} title={PLATFORM_LABEL[video.platform]}>
          <PlatformIcon size={18} aria-hidden="true" />
        </span>
        <div className="form-video-card__text">
          <h2 className="form-video-card__title">{video.videoName}</h2>
          <span className="form-video-card__url" title={video.videoUrl}>
            {readableUrl(video.videoUrl)}
          </span>
        </div>
      </div>

      {preview.kind === 'youtube' && (
        <div className="form-video-card__embed" data-testid="form-video-embed">
          {/* Privacy-enhanced embed, never autoplays; sandboxed. */}
          <iframe
            src={preview.embedUrl}
            title={`${video.videoName} (YouTube)`}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
            allow="encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        </div>
      )}
      {preview.kind === 'instagram' &&
        (showInstagramPreview ? (
          <div className="form-video-card__embed form-video-card__embed--instagram" data-testid="form-video-embed">
            <iframe
              src={preview.embedUrl}
              title={`${video.videoName} (Instagram)`}
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              sandbox="allow-scripts allow-same-origin allow-popups"
            />
          </div>
        ) : (
          <button type="button" className="form-video-card__load" onClick={() => setShowInstagramPreview(true)} data-testid="form-video-load-preview">
            <PlayCircle size={18} aria-hidden="true" /> Show Instagram preview
          </button>
        ))}
      {preview.kind === 'link' && (
        <a className="form-video-card__link" href={video.videoUrl} target="_blank" rel="noopener noreferrer nofollow" data-testid="form-video-link-card">
          <Globe size={16} aria-hidden="true" />
          <span>Preview not available — open the video on {PLATFORM_LABEL[video.platform] === 'Link' ? 'its website' : PLATFORM_LABEL[video.platform]}.</span>
        </a>
      )}

      <div className="form-video-card__actions">
        <a className="button button--ghost button--compact" href={video.videoUrl} target="_blank" rel="noopener noreferrer nofollow" data-testid="form-video-open">
          <ExternalLink size={16} aria-hidden="true" /> Open Video
        </a>
        <button type="button" className="icon-button" onClick={onEdit} aria-label={`Edit ${video.videoName}`} title="Edit" data-testid="form-video-edit">
          <Pencil size={16} aria-hidden="true" />
        </button>
        <button type="button" className="icon-button" onClick={onCopy} aria-label={`Copy link of ${video.videoName}`} title="Copy link" data-testid="form-video-copy">
          <Copy size={16} aria-hidden="true" />
        </button>
        <button type="button" className="icon-button icon-button--danger" onClick={onDelete} aria-label={`Delete ${video.videoName}`} title="Delete" data-testid="form-video-delete">
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}

function FormVideoEditor({
  isOpen,
  video,
  onClose,
  onSave,
}: {
  isOpen: boolean;
  video: ExerciseFormVideo | null;
  onClose: () => void;
  onSave: (input: ExerciseFormVideoInput) => Promise<void>;
}) {
  const nameId = useId();
  const urlId = useId();
  const platformId = useId();
  const [videoName, setVideoName] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [platform, setPlatform] = useState<FormVideoPlatform>('YOUTUBE');
  /** Once the user picks a platform by hand, typing a URL no longer changes it. */
  const [platformChosenByUser, setPlatformChosenByUser] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setVideoName(video?.videoName ?? '');
    setVideoUrl(video?.videoUrl ?? '');
    setPlatform(video?.platform ?? 'YOUTUBE');
    setPlatformChosenByUser(Boolean(video));
    setError(null);
    setSaving(false);
  }, [isOpen, video]);

  const changeUrl = (next: string) => {
    setVideoUrl(next);
    setError(null);
    const detected = detectVideoPlatform(next);
    if (detected && !platformChosenByUser) setPlatform(detected);
  };

  const submit = async () => {
    const nameProblem = validateVideoName(videoName);
    if (nameProblem) return setError(nameProblem);
    const parsed = parseVideoUrl(videoUrl);
    if (!parsed.ok) return setError(parsed.error);
    setSaving(true);
    setError(null);
    try {
      await onSave({ videoName: videoName.trim(), videoUrl: parsed.url, platform });
    } catch (saveError) {
      setError(errorMessage(saveError, 'Could not save the video.'));
    } finally {
      setSaving(false);
    }
  };

  const detected = detectVideoPlatform(videoUrl);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={video ? 'Edit form video' : 'Add form video'} placement="top">
      <form
        className="form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="field">
          <label className="field__label" htmlFor={nameId}>
            Video name
          </label>
          <input
            id={nameId}
            className="field__input"
            value={videoName}
            maxLength={VIDEO_NAME_MAX_LENGTH}
            placeholder="e.g. Elbow path cue"
            onChange={(event) => {
              setVideoName(event.target.value);
              setError(null);
            }}
            data-autofocus
            data-testid="form-video-name"
          />
        </div>
        <div className="field">
          <label className="field__label" htmlFor={urlId}>
            Video URL
          </label>
          <input
            id={urlId}
            className="field__input"
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={videoUrl}
            placeholder="https://www.youtube.com/watch?v=…"
            onChange={(event) => changeUrl(event.target.value)}
            data-testid="form-video-url"
          />
          {detected && detected !== 'OTHER' && (
            <span className="photo-picker__hint">
              <Check size={12} aria-hidden="true" /> Looks like a {PLATFORM_LABEL[detected]} link.
            </span>
          )}
        </div>
        <div className="field">
          <label className="field__label" htmlFor={platformId}>
            Platform
          </label>
          <select
            id={platformId}
            className="field__input field__select"
            value={platform}
            onChange={(event) => {
              setPlatform(event.target.value as FormVideoPlatform);
              setPlatformChosenByUser(true);
            }}
            data-testid="form-video-platform"
          >
            {FORM_VIDEO_PLATFORMS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        {error && (
          <p className="field__error" role="alert" data-testid="form-video-error">
            {error}
          </p>
        )}
        <div className="modal__actions">
          <button type="button" className="button button--ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="button button--primary" disabled={saving} data-testid="form-video-save">
            {saving && <Loader2 size={18} className="spin" aria-hidden="true" />} Save
          </button>
        </div>
      </form>
    </Modal>
  );
}
