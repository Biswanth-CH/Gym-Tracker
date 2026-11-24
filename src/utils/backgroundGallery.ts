import type { BackgroundImage } from '../types/gym';

/** One "Uploaded by – <profile>" section of the background gallery. */
export interface GalleryGroup {
  /** Profile id, or null for images whose uploading profile was deleted. */
  profileId: string | null;
  label: string;
  images: BackgroundImage[];
}

/**
 * Groups gallery images by uploading profile: one group per profile that has uploaded at
 * least one image (in profile order; profiles without uploads are left out), newest image
 * first, plus a final group for images of deleted profiles when there are any.
 */
export function groupGalleryImages(images: readonly BackgroundImage[], profiles: ReadonlyArray<{ id: string; name: string }>): GalleryGroup[] {
  const newestFirst = [...images].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
  const knownIds = new Set(profiles.map((profile) => profile.id));
  const groups: GalleryGroup[] = profiles
    .map((profile) => ({
      profileId: profile.id,
      label: profile.name,
      images: newestFirst.filter((image) => image.uploaderProfileId === profile.id),
    }))
    .filter((group) => group.images.length > 0);
  const orphans = newestFirst.filter((image) => image.uploaderProfileId === null || !knownIds.has(image.uploaderProfileId));
  if (orphans.length > 0) groups.push({ profileId: null, label: 'A deleted profile', images: orphans });
  return groups;
}
