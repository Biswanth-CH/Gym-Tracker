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
    // Signed Storage URLs are cross-origin: request CORS so the canvas isn't tainted when re-cropping.
    if (/^https?:/i.test(url)) image.crossOrigin = 'anonymous';
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

/** Size that fits `maxDimension` on the longest side, never enlarging. Exported for tests. */
export function fitWithin(width: number, height: number, maxDimension: number): { width: number; height: number } {
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), type, quality));
}

/**
 * Card backgrounds (Phase 7): validates the file, scales it to ≤ `maxDimension` on the
 * longest side and re-encodes it (WebP, JPEG fallback), lowering quality and size until
 * it is under `maxBytes` (the private bucket accepts up to 1 MB).
 */
export async function compressBackgroundImage(file: File, maxDimension: number, maxBytes: number): Promise<Blob> {
  const validationError = validateImageFile(file);
  if (validationError) throw new ImageProcessingError(validationError);
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    let dimension = maxDimension;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const size = fitWithin(image.naturalWidth, image.naturalHeight, dimension);
      const canvas = document.createElement('canvas');
      canvas.width = size.width;
      canvas.height = size.height;
      const context = canvas.getContext('2d');
      if (!context) throw new ImageProcessingError('This browser can’t process images.');
      context.drawImage(image, 0, 0, size.width, size.height);
      for (const quality of [0.82, 0.7, 0.58]) {
        const webp = await canvasToBlob(canvas, 'image/webp', quality);
        const blob = webp && webp.type === 'image/webp' ? webp : await canvasToBlob(canvas, 'image/jpeg', quality);
        if (blob && blob.size <= maxBytes) return blob;
      }
      dimension = Math.round(dimension * 0.75);
    }
    throw new ImageProcessingError('This image couldn’t be made small enough. Please try a different one.');
  } finally {
    URL.revokeObjectURL(url);
  }
}
