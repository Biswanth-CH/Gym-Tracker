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

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ImageProcessingError('This image couldn’t be read. Please try a different file.'));
    };
    image.src = url;
  });
}

/**
 * Centre-crops the image to a square, resizes it to AVATAR_SIZE_PX and
 * compresses it (WebP, falling back to JPEG), returning a small data URL that
 * is safe to keep in LocalStorage. The original full-size file is never stored.
 */
export async function processProfileImage(file: File): Promise<string> {
  const validationError = validateImageFile(file);
  if (validationError) throw new ImageProcessingError(validationError);

  const image = await loadImage(file);
  const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
  if (!sourceSize) throw new ImageProcessingError('This image has no visible content.');

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
  const sourceX = (image.naturalWidth - sourceSize) / 2;
  const sourceY = (image.naturalHeight - sourceSize) / 2;
  context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, AVATAR_SIZE_PX, AVATAR_SIZE_PX);

  for (const quality of [0.85, 0.7, 0.55]) {
    let dataUrl = canvas.toDataURL('image/webp', quality);
    // Browsers without WebP encoding silently return PNG; use JPEG instead.
    if (!dataUrl.startsWith('data:image/webp')) dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrl.length <= MAX_AVATAR_DATA_URL_LENGTH) return dataUrl;
  }
  throw new ImageProcessingError('This image couldn’t be compressed enough. Please try a simpler photo.');
}
