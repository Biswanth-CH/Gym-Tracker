import {
  ACCEPTED_IMAGE_EXTENSIONS,
  ACCEPTED_IMAGE_TYPES,
  AVATAR_SIZE_PX,
  MAX_AVATAR_DATA_URL_LENGTH,
  MAX_UPLOAD_BYTES,
} from '../constants/profileOptions';

export class ImageProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageProcessingError';
  }
}

/** Returns a user-facing message if the file can't be used, otherwise null. */
export function validateImageFile(file: File): string | null {
  const lowerName = file.name.toLowerCase();
  const typeOk = (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type);
  // Some browsers/OSes leave `type` empty; fall back to the extension then.
  const extensionOk = ACCEPTED_IMAGE_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
  if (!(typeOk || (file.type === '' && extensionOk))) {
    return 'Please choose a JPG, PNG or WebP image.';
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `That image is too large. Please choose one under ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`;
  }
  if (file.size === 0) return 'That file is empty.';
  return null;
}

/** Loads an image from an object URL or data URL. */
export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () =>
      image.naturalWidth && image.naturalHeight
        ? resolve(image)
        : reject(new ImageProcessingError('This image has no visible content.'));
    image.onerror = () => reject(new ImageProcessingError('This image couldn’t be read. Please try a different file.'));
    image.src = url;
  });
}

/** Square region of the source image, in source pixels. */
export interface CropArea {
  x: number;
  y: number;
  size: number;
}

export function centreCrop(image: HTMLImageElement): CropArea {
  const size = Math.min(image.naturalWidth, image.naturalHeight);
  return { x: (image.naturalWidth - size) / 2, y: (image.naturalHeight - size) / 2, size };
}

/**
 * Draws the crop area into an AVATAR_SIZE_PX square and compresses it
 * (WebP, falling back to JPEG). Only this small result is ever stored —
 * never the original upload.
 */
export function renderAvatar(image: HTMLImageElement, crop: CropArea): string {
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_SIZE_PX;
  canvas.height = AVATAR_SIZE_PX;
  const context = canvas.getContext('2d');
  if (!context) throw new ImageProcessingError('Your browser couldn’t process this image.');

  // Fill first so transparent PNGs don't turn black when exported as JPEG.
  context.fillStyle = '#1b1f26';
  context.fillRect(0, 0, AVATAR_SIZE_PX, AVATAR_SIZE_PX);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, crop.x, crop.y, crop.size, crop.size, 0, 0, AVATAR_SIZE_PX, AVATAR_SIZE_PX);

  for (const quality of [0.85, 0.7, 0.55]) {
    let dataUrl = canvas.toDataURL('image/webp', quality);
    // Browsers without WebP encoding silently return PNG; use JPEG instead.
    if (!dataUrl.startsWith('data:image/webp')) dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrl.length <= MAX_AVATAR_DATA_URL_LENGTH) return dataUrl;
  }
  throw new ImageProcessingError('This image couldn’t be compressed enough. Please try a simpler photo.');
}

/** Validates, centre-crops and compresses a file in one step (no manual adjustment). */
export async function processProfileImage(file: File): Promise<string> {
  const validationError = validateImageFile(file);
  if (validationError) throw new ImageProcessingError(validationError);
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    return renderAvatar(image, centreCrop(image));
  } finally {
    URL.revokeObjectURL(url);
  }
}
