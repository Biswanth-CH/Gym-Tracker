import { useMemo } from 'react';
import { toBackgroundImage } from '../services/cloud/rows';
import type { BackgroundImage } from '../types/gym';
import { groupGalleryImages, type GalleryGroup } from '../utils/backgroundGallery';
import { useCloudSlice } from './useCloud';

/** The account's shared background gallery, grouped by the uploading profile (Phase 8b). */
export function useBackgroundGallery(): { images: BackgroundImage[]; groups: GalleryGroup[] } {
  const rows = useCloudSlice((snapshot) => snapshot.backgroundImages);
  const profiles = useCloudSlice((snapshot) => snapshot.profiles);
  const photoUrls = useCloudSlice((snapshot) => snapshot.photoUrls);
  return useMemo(() => {
    const images = rows
      .map((row) => toBackgroundImage(row, photoUrls[row.storage_path] ?? null))
      .filter((image): image is BackgroundImage => image !== null);
    const owners = [...profiles]
      .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
      .map((profile) => ({ id: profile.id, name: profile.name }));
    return { images, groups: groupGalleryImages(images, owners) };
  }, [rows, profiles, photoUrls]);
}
