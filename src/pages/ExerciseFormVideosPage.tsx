import { useEffect, useId, useState } from 'react';
import { AlertTriangle, Archive, ArchiveRestore, Check, Copy, ExternalLink, Eye, EyeOff, Globe, Instagram, Loader2, Pencil, Plus, Trash2, Video, Youtube } from 'lucide-react';
import { BackButton } from '../components/BackButton';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { Toast } from '../components/Toast';
import { getEquipmentNames } from '../constants/gymEquipment';
import { useFormVideos } from '../hooks/useFormVideos';
import { DELETE_SHARED_VIDEO_WARNING, EDIT_SHARED_VIDEO_WARNING } from '../utils/formVideoVisibility';
import { useToast } from '../hooks/useToast';
import { errorMessage } from '../services/cloud/cloudErrors';
import type { ExerciseFormVideo, ExerciseFormVideoInput, FormVideoPlatform, LibraryExercise, MuscleGroup, MuscleRegion, Profile } from '../types/gym';
import {
  FORM_VIDEO_PLATFORMS,
  VIDEO_NAME_MAX_LENGTH,
  detectVideoPlatform,
  parseVideoUrl,
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

/**
 * Form reference videos for ONE exercise variation. Phase 8: videos are SHARED by every
 * account; each profile can hide videos for itself (Hidden Videos lists and restores them).
 * Only the account that added a video can edit or delete it, after a global warning.
 */
export function ExerciseFormVideosPage({ profile, group, region, exercise, onBack }: ExerciseFormVideosPageProps) {
  const { videos, hiddenVideos, isLoading, canModify, addVideo, updateVideo, deleteVideo, hideVideo, unhideVideo } = useFormVideos(profile.id, exercise.id);
  const { toast, showToast } = useToast();
  const [editor, setEditor] = useState<{ isOpen: false } | { isOpen: true; video: ExerciseFormVideo | null }>({ isOpen: false });
  const [videoPendingEdit, setVideoPendingEdit] = useState<ExerciseFormVideo | null>(null);
  const [videoPendingDelete, setVideoPendingDelete] = useState<ExerciseFormVideo | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [busyVideoId, setBusyVideoId] = useState<string | null>(null);

  const confirmDelete = async () => {
    if (!videoPendingDelete) return;
    setDeleting(true);
    try {
      await deleteVideo(videoPendingDelete.id);
      showToast(`Deleted “${videoPendingDelete.videoName}” for everyone`, 'info');
      setVideoPendingDelete(null);
    } catch (error) {
      showToast(errorMessage(error, 'Could not delete the video.'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  const toggleHidden = async (video: ExerciseFormVideo, hide: boolean) => {
    setBusyVideoId(video.id);
    try {
      if (hide) {
        await hideVideo(video.id);
        showToast(`Hidden for ${profile.name}`, 'info');
      } else {
        await unhideVideo(video.id);
        showToast(`“${video.videoName}” is visible again`);
      }
    } catch (error) {
      showToast(errorMessage(error, hide ? 'Could not hide the video.' : 'Could not unhide the video.'), 'error');
    } finally {
      setBusyVideoId(null);
    }
  };

  const copyLink = async (video: ExerciseFormVideo) => {
    try {
      await copyToClipboard(video.videoUrl);
      showToast('Link copied');
    } catch (error) {
      showToast(errorMessage(error, 'Could not copy the link.'), 'error');
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
        <p className="form-videos__shared-note">Shared with everyone using GymTrack. Hiding a video only hides it for {profile.name}.</p>
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
          title={hiddenVideos.length > 0 ? 'All videos are hidden' : 'No form videos yet'}
          message={
            hiddenVideos.length > 0
              ? `${profile.name} has hidden every video for this variation. Open Hidden Videos to show them again.`
              : 'Share YouTube, Instagram or other links that show good form for this variation. Everyone using GymTrack will see them.'
          }
        />
      ) : (
        <ul className="form-video-list" data-testid="form-video-list">
          {videos.map((video) => (
            <li key={video.id}>
              <FormVideoCard
                video={video}
                canModify={canModify(video)}
                busy={busyVideoId === video.id}
                onEdit={() => setVideoPendingEdit(video)}
                onDelete={() => setVideoPendingDelete(video)}
                onHide={() => void toggleHidden(video, true)}
                onCopy={() => void copyLink(video)}
              />
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        className="button button--ghost form-videos__hidden-toggle"
        onClick={() => setShowHidden(true)}
        data-testid="form-video-hidden-button"
      >
        <EyeOff size={16} aria-hidden="true" /> Hidden Videos{hiddenVideos.length > 0 ? ` (${hiddenVideos.length})` : ''}
      </button>

      <Modal
        isOpen={showHidden}
        onClose={() => setShowHidden(false)}
        title="Hidden videos"
        description={`Hidden only for ${profile.name}. Other profiles and accounts still see them.`}
        placement="top"
      >
        {hiddenVideos.length === 0 ? (
          <p className="split-list__empty" data-testid="form-video-hidden-empty">
            No hidden videos for this variation.
          </p>
        ) : (
          <ul className="hidden-video-list" data-testid="form-video-hidden-list">
            {hiddenVideos.map((video) => {
              const PlatformIcon = PLATFORM_ICON[video.platform];
              return (
                <li key={video.id} className="hidden-video" data-testid="form-video-hidden-item">
                  <PlatformIcon size={16} aria-hidden="true" />
                  <span className="hidden-video__name">{video.videoName}</span>
                  <button
                    type="button"
                    className="button button--ghost button--compact"
                    onClick={() => void toggleHidden(video, false)}
                    disabled={busyVideoId === video.id}
                    data-testid="form-video-unhide"
                  >
                    <ArchiveRestore size={16} aria-hidden="true" /> Unhide
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="modal__actions">
          <button type="button" className="button button--ghost" onClick={() => setShowHidden(false)}>
            Close
          </button>
        </div>
      </Modal>

      <FormVideoEditor
        isOpen={editor.isOpen}
        video={editor.isOpen ? editor.video : null}
        onClose={() => setEditor({ isOpen: false })}
        onSave={async (input) => {
          if (editor.isOpen && editor.video) {
            await updateVideo(editor.video, input);
            showToast('Video updated for everyone');
          } else {
            await addVideo(input);
            showToast('Video shared');
          }
          setEditor({ isOpen: false });
        }}
      />
      <ConfirmDialog
        isOpen={videoPendingEdit !== null}
        title="Edit shared video?"
        description={EDIT_SHARED_VIDEO_WARNING}
        confirmLabel="Continue"
        icon={<AlertTriangle size={24} aria-hidden="true" />}
        onCancel={() => setVideoPendingEdit(null)}
        onConfirm={() => {
          const video = videoPendingEdit;
          setVideoPendingEdit(null);
          if (video) setEditor({ isOpen: true, video });
        }}
      />
      <ConfirmDialog
        isOpen={videoPendingDelete !== null}
        title="Delete shared video?"
        description={DELETE_SHARED_VIDEO_WARNING}
        confirmLabel={deleting ? 'Deleting…' : 'Delete for everyone'}
        icon={<Trash2 size={24} aria-hidden="true" />}
        destructive
        onCancel={() => setVideoPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
      <Toast toast={toast} />
    </div>
  );
}

function FormVideoCard({
  video,
  canModify,
  busy,
  onEdit,
  onDelete,
  onHide,
  onCopy,
}: {
  video: ExerciseFormVideo;
  /** Only the account that added the video may edit / delete it (RLS enforces the same). */
  canModify: boolean;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onHide: () => void;
  onCopy: () => void;
}) {
  const PlatformIcon = PLATFORM_ICON[video.platform];
  const preview = videoPreviewFor(video.videoUrl, video.platform);
  const hasEmbed = preview.kind === 'youtube' || preview.kind === 'instagram';
  // Previews stay hidden until asked for (per video); embeds never autoplay.
  const [showPreview, setShowPreview] = useState(false);

  return (
    <article className="form-video-card" data-platform={video.platform} data-testid="form-video-card">
      <div className="form-video-card__head">
        <span className={`form-video-card__icon form-video-card__icon--${video.platform.toLowerCase()}`} aria-label={PLATFORM_LABEL[video.platform]} title={PLATFORM_LABEL[video.platform]}>
          <PlatformIcon size={18} aria-hidden="true" />
        </span>
        <div className="form-video-card__text">
          <h2 className="form-video-card__title">{video.videoName}</h2>
          {!canModify && <span className="form-video-card__owner">Shared by another account</span>}
        </div>
      </div>

      {showPreview && preview.kind === 'youtube' && (
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
      {showPreview && preview.kind === 'instagram' && (
        <div className="form-video-card__embed form-video-card__embed--instagram" data-testid="form-video-embed">
          <iframe
            src={preview.embedUrl}
            title={`${video.videoName} (Instagram)`}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-popups"
          />
        </div>
      )}

      <div className="form-video-card__actions">
        <a className="button button--ghost button--compact" href={video.videoUrl} target="_blank" rel="noopener noreferrer nofollow" data-testid="form-video-open">
          <ExternalLink size={16} aria-hidden="true" /> Open
        </a>
        {hasEmbed && (
          <button
            type="button"
            className={`icon-button${showPreview ? ' is-active' : ''}`}
            onClick={() => setShowPreview((current) => !current)}
            aria-pressed={showPreview}
            aria-label={showPreview ? `Hide preview of ${video.videoName}` : `Show preview of ${video.videoName}`}
            title={showPreview ? 'Hide preview' : 'Show preview'}
            data-testid="form-video-preview-toggle"
          >
            {showPreview ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
          </button>
        )}
        {canModify && (
          <button type="button" className="icon-button" onClick={onEdit} aria-label={`Edit ${video.videoName}`} title="Edit" data-testid="form-video-edit">
            <Pencil size={16} aria-hidden="true" />
          </button>
        )}
        <button type="button" className="icon-button" onClick={onCopy} aria-label={`Copy link of ${video.videoName}`} title="Copy link" data-testid="form-video-copy">
          <Copy size={16} aria-hidden="true" />
        </button>
        <button type="button" className="icon-button" onClick={onHide} disabled={busy} aria-label={`Hide ${video.videoName} for this profile`} title="Hide for this profile" data-testid="form-video-hide">
          <Archive size={16} aria-hidden="true" />
        </button>
        {canModify && (
          <button type="button" className="icon-button icon-button--danger" onClick={onDelete} aria-label={`Delete ${video.videoName}`} title="Delete" data-testid="form-video-delete">
            <Trash2 size={16} aria-hidden="true" />
          </button>
        )}
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
