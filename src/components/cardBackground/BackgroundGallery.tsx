import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown, ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { ACCEPTED_IMAGE_TYPES } from '../../constants/profileOptions';
import { useBackgroundGallery } from '../../hooks/useBackgroundGallery';
import { useCloudSlice } from '../../hooks/useCloud';
import { backgroundGalleryService, canDeleteBackgroundImage } from '../../services/cloud/backgroundGalleryService';
import { errorMessage } from '../../services/cloud/cloudErrors';
import { backgroundUsage } from '../../services/cloud/imageReferences';
import type { BackgroundImage } from '../../types/gym';
import { MAX_BACKGROUND_BYTES, MAX_BACKGROUND_DIMENSION } from '../../utils/cardBackground';
import { formatShortDate } from '../../utils/dateUtils';
import { compressBackgroundImage } from '../../utils/imageUtils';

interface BackgroundGalleryProps {
  /** The profile using the editor: new uploads belong to it, and only its own uploads can be deleted. */
  actingProfileId: string;
  /** Path of the image currently chosen in the editor (marked as selected). */
  selectedPath: string | null;
  /** Use an image by reference (no second upload). `imageUrl` may be a local preview right after uploading. */
  onSelect: (choice: { storagePath: string; imageUrl: string | null }) => void;
  /** Called after an image was deleted (cards using it are already back to their default look). */
  onDeleted?: (storagePath: string) => void;
}

/**
 * Shared background gallery (Phase 8b): every image of the account, grouped by the profile that
 * uploaded it. Select (by reference), upload a new image (as the acting profile) or delete one of
 * the acting profile's own images. Deleting asks first; every card using the image then returns to
 * its default background (Phase 8c).
 */
const groupKey = (profileId: string | null) => profileId ?? 'deleted';

export function BackgroundGallery({ actingProfileId, selectedPath, onSelect, onDeleted }: BackgroundGalleryProps) {
  const { groups } = useBackgroundGallery();
  const userId = useCloudSlice((snapshot) => snapshot.userId);
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  // The acting profile's own uploads open first; otherwise the first group with images.
  const [openGroups, setOpenGroups] = useState<ReadonlySet<string>>(() =>
    new Set([groups.some((group) => group.profileId === actingProfileId) ? actingProfileId : groupKey(groups[0]?.profileId ?? null)]),
  );
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<BackgroundImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Files whose delete could not finish earlier (e.g. offline) are retried here.
  useEffect(() => {
    void backgroundGalleryService.retryPendingFileDeletes();
  }, []);

  const toggleGroup = (key: string) =>
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!userId) return setError('You are signed out. Please sign in again.');
    setError(null);
    setNotice(null);
    setUploading(true);
    try {
      const blob = await compressBackgroundImage(file, MAX_BACKGROUND_DIMENSION, MAX_BACKGROUND_BYTES);
      const row = await backgroundGalleryService.upload(userId, actingProfileId, blob);
      setOpenGroups((current) => new Set([...current, actingProfileId]));
      // Local preview until the signed URL arrives.
      onSelect({ storagePath: row.storage_path, imageUrl: URL.createObjectURL(blob) });
      setNotice('Uploaded and selected.');
    } catch (uploadError) {
      setError(errorMessage(uploadError, 'This image could not be uploaded.'));
    } finally {
      setUploading(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setError(null);
    const deleted = pendingDelete;
    try {
      const { fileDeleted } = await backgroundGalleryService.remove(deleted, actingProfileId);
      setPendingDelete(null);
      onDeleted?.(deleted.storagePath);
      setNotice(
        fileDeleted
          ? 'Background deleted. Cards that used it are back to their default look.'
          : 'Background removed from every card and the gallery. The file itself couldn’t be deleted right now; GymTrack will retry automatically.',
      );
    } catch (deleteError) {
      // The database change is all-or-nothing: on an error nothing was changed or deleted.
      setError(errorMessage(deleteError, 'Could not delete the image. Nothing was changed.'));
    } finally {
      setDeleting(false);
    }
  };

  const pendingUsage = pendingDelete ? backgroundUsage(pendingDelete.storagePath) : [];
  const nameOf = (profileId: string | null) => groups.find((group) => group.profileId === profileId)?.label ?? 'A deleted profile';

  return (
    <div className="bg-gallery" data-testid="background-gallery">
      <div className="bg-gallery__upload">
        <button type="button" className="button button--ghost button--compact" onClick={() => fileInputRef.current?.click()} disabled={uploading} data-testid="gallery-upload">
          {uploading ? <Loader2 size={16} className="spin" aria-hidden="true" /> : <ImagePlus size={16} aria-hidden="true" />} {uploading ? 'Uploading…' : 'Upload new image'}
        </button>
        <input
          id={inputId}
          ref={fileInputRef}
          className="visually-hidden"
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(',')}
          tabIndex={-1}
          aria-label="Upload a background image"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            void upload(file);
          }}
          data-testid="card-bg-file"
        />
        <span className="photo-picker__hint">JPG, PNG or WebP · resized before upload · shared with every profile</span>
      </div>

      {pendingDelete && (
        <div className="bg-gallery__confirm" role="alertdialog" aria-labelledby={`${inputId}-confirm`} data-testid="gallery-delete-confirm">
          <div className="bg-gallery__confirm-image">
            {pendingDelete.imageUrl ? <img src={pendingDelete.imageUrl} alt="" /> : <span className="bg-gallery__thumb-placeholder" aria-hidden="true" />}
            <span className="bg-gallery__confirm-owner" data-testid="gallery-delete-uploader">
              Uploaded by {nameOf(pendingDelete.uploaderProfileId)}
            </span>
          </div>
          <p id={`${inputId}-confirm`} data-testid="gallery-delete-message">
            Are you sure you want to delete this background image? It will be removed from every profile card and weekly card currently using it. Those cards
            will return to their default background.
          </p>
          {pendingUsage.length > 0 && (
            <p className="bg-gallery__confirm-usage" data-testid="gallery-delete-usage">
              Currently used by: {pendingUsage.join(', ')}
            </p>
          )}
          <div className="modal__actions">
            <button type="button" className="button button--ghost" onClick={() => setPendingDelete(null)} disabled={deleting} data-testid="gallery-delete-cancel">
              Cancel
            </button>
            <button type="button" className="button button--danger" onClick={() => void confirmDelete()} disabled={deleting} data-testid="gallery-delete-confirm-button">
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="field__error" role="alert" data-testid="gallery-error">
          {error}
        </p>
      )}
      {notice && !error && (
        <p className="inline-success" role="status">
          {notice}
        </p>
      )}

      <div className="bg-gallery__groups">
        {groups.length === 0 && (
          <p className="bg-gallery__empty bg-gallery__empty--all" data-testid="gallery-empty">
            No backgrounds uploaded yet. Upload one to get started.
          </p>
        )}
        {groups.map((group) => {
          const key = groupKey(group.profileId);
          const isOpen = openGroups.has(key);
          return (
            <section key={key} className={`bg-gallery__group${isOpen ? ' is-open' : ''}`} data-testid="gallery-group" data-profile-id={group.profileId ?? ''}>
              <button type="button" className="bg-gallery__group-header" aria-expanded={isOpen} onClick={() => toggleGroup(key)} data-testid="gallery-group-toggle">
                <span className="bg-gallery__group-title">Uploaded by – {group.label}</span>
                <span className="bg-gallery__group-count">{group.images.length}</span>
                <ChevronDown size={16} className="split-group__chevron" aria-hidden="true" />
              </button>
              {isOpen && (
                  <ul className="bg-gallery__grid">
                    {group.images.map((image) => {
                      const isSelected = image.storagePath === selectedPath;
                      const deletable = canDeleteBackgroundImage(image, actingProfileId);
                      return (
                        <li key={image.id} className={`bg-gallery__item${isSelected ? ' is-selected' : ''}`} data-testid="gallery-image" data-path={image.storagePath}>
                          <button
                            type="button"
                            className="bg-gallery__thumb"
                            onClick={() => onSelect({ storagePath: image.storagePath, imageUrl: image.imageUrl })}
                            aria-pressed={isSelected}
                            aria-label={`Use background uploaded by ${nameOf(image.uploaderProfileId)} on ${formatShortDate(image.createdAt.slice(0, 10))}`}
                            data-testid="gallery-image-select"
                          >
                            {image.imageUrl ? <img src={image.imageUrl} alt="" loading="lazy" decoding="async" /> : <span className="bg-gallery__thumb-placeholder" aria-hidden="true" />}
                            {isSelected && (
                              <span className="bg-gallery__selected" aria-hidden="true">
                                <Check size={14} />
                              </span>
                            )}
                          </button>
                          <span className="bg-gallery__meta">{formatShortDate(image.createdAt.slice(0, 10))}</span>
                          {deletable && (
                            <button
                              type="button"
                              className="icon-button icon-button--danger bg-gallery__delete"
                              onClick={() => {
                                setError(null);
                                setNotice(null);
                                setPendingDelete(image);
                              }}
                              aria-label="Delete this image from the gallery"
                              title="Delete"
                              data-testid="gallery-image-delete"
                            >
                              <Trash2 size={14} aria-hidden="true" />
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
