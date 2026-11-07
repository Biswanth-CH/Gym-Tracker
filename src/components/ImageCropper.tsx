import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Check, Loader2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { loadImage, renderAvatar } from '../utils/imageUtils';

interface ImageCropperProps {
  /** Object URL or data URL of the picture to adjust. */
  sourceUrl: string;
  onCancel: () => void;
  onConfirm: (dataUrl: string) => void;
  onError: (message: string) => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;
const KEY_PAN_PX = 12;

interface Offset {
  x: number;
  y: number;
}

/**
 * Square crop with a circular guide. The image always covers the frame:
 * zoom ≥ 1 is relative to a "cover" fit, and panning is clamped so no empty
 * space can appear. Drag (mouse / touch), pinch, wheel, slider, buttons and
 * arrow keys are all supported.
 */
export function ImageCropper({ sourceUrl, onCancel, onConfirm, onError }: ImageCropperProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [frameSize, setFrameSize] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchDistance = useRef<number | null>(null);

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    let cancelled = false;
    loadImage(sourceUrl)
      .then((loaded) => !cancelled && setImage(loaded))
      .catch((error: unknown) => !cancelled && onErrorRef.current(error instanceof Error ? error.message : 'This image couldn’t be read.'));
    return () => {
      cancelled = true;
    };
  }, [sourceUrl]);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const measure = () => setFrameSize(frame.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const baseScale = image && frameSize ? frameSize / Math.min(image.naturalWidth, image.naturalHeight) : 1;
  const scale = baseScale * zoom;
  const displayWidth = image ? image.naturalWidth * scale : 0;
  const displayHeight = image ? image.naturalHeight * scale : 0;

  const clamp = useCallback(
    (next: Offset, width = displayWidth, height = displayHeight): Offset => ({
      x: Math.min(0, Math.max(frameSize - width, next.x)),
      y: Math.min(0, Math.max(frameSize - height, next.y)),
    }),
    [displayWidth, displayHeight, frameSize],
  );

  const centre = useCallback(() => {
    if (!image || !frameSize) return;
    const width = image.naturalWidth * baseScale;
    const height = image.naturalHeight * baseScale;
    setZoom(1);
    setOffset({ x: (frameSize - width) / 2, y: (frameSize - height) / 2 });
  }, [image, frameSize, baseScale]);

  // Centre once the image and frame size are known.
  useEffect(centre, [image, frameSize]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Zooms while keeping the frame centre fixed on the same image point. */
  const applyZoom = useCallback(
    (nextZoom: number) => {
      if (!image || !frameSize) return;
      const clampedZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
      const nextScale = baseScale * clampedZoom;
      setOffset((current) => {
        const centreX = (frameSize / 2 - current.x) / scale;
        const centreY = (frameSize / 2 - current.y) / scale;
        return clamp(
          { x: frameSize / 2 - centreX * nextScale, y: frameSize / 2 - centreY * nextScale },
          image.naturalWidth * nextScale,
          image.naturalHeight * nextScale,
        );
      });
      setZoom(clampedZoom);
    },
    [image, frameSize, baseScale, scale, clamp],
  );

  // Wheel zoom needs a non-passive listener to stop the page scrolling.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      applyZoom(zoom * (event.deltaY < 0 ? 1.1 : 1 / 1.1));
    };
    frame.addEventListener('wheel', onWheel, { passive: false });
    return () => frame.removeEventListener('wheel', onWheel);
  }, [applyZoom, zoom]);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    pinchDistance.current = null;
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    const current = { x: event.clientX, y: event.clientY };
    pointers.current.set(event.pointerId, current);

    if (pointers.current.size >= 2) {
      const [a, b] = Array.from(pointers.current.values());
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDistance.current) applyZoom(zoom * (distance / pinchDistance.current));
      pinchDistance.current = distance;
      return;
    }
    setOffset((offsetNow) => clamp({ x: offsetNow.x + current.x - previous.x, y: offsetNow.y + current.y - previous.y }));
  };

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinchDistance.current = null;
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, Offset> = {
      ArrowLeft: { x: KEY_PAN_PX, y: 0 },
      ArrowRight: { x: -KEY_PAN_PX, y: 0 },
      ArrowUp: { x: 0, y: KEY_PAN_PX },
      ArrowDown: { x: 0, y: -KEY_PAN_PX },
    };
    if (moves[event.key]) {
      event.preventDefault();
      const move = moves[event.key];
      setOffset((current) => clamp({ x: current.x + move.x, y: current.y + move.y }));
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      applyZoom(zoom + ZOOM_STEP);
    } else if (event.key === '-') {
      event.preventDefault();
      applyZoom(zoom - ZOOM_STEP);
    }
  };

  const handleConfirm = () => {
    if (!image || !frameSize) return;
    setIsSaving(true);
    try {
      onConfirm(renderAvatar(image, { x: -offset.x / scale, y: -offset.y / scale, size: frameSize / scale }));
    } catch (error) {
      onError(error instanceof Error ? error.message : 'This image couldn’t be processed.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="cropper">
      <div
        ref={frameRef}
        className="cropper__frame"
        tabIndex={0}
        role="application"
        aria-label="Crop area. Drag or use the arrow keys to move the photo, plus and minus to zoom."
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onKeyDown={handleKeyDown}
        data-testid="crop-frame"
      >
        {image ? (
          <img
            className="cropper__image"
            src={sourceUrl}
            alt=""
            draggable={false}
            style={{ width: displayWidth, height: displayHeight, transform: `translate(${offset.x}px, ${offset.y}px)` }}
          />
        ) : (
          <span className="cropper__loading">
            <Loader2 size={28} className="spin" aria-hidden="true" />
          </span>
        )}
        <span className="cropper__mask" aria-hidden="true" />
      </div>

      <div className="cropper__zoom">
        <button type="button" className="icon-button" onClick={() => applyZoom(zoom - ZOOM_STEP)} disabled={!image || zoom <= MIN_ZOOM} aria-label="Zoom out">
          <ZoomOut size={18} aria-hidden="true" />
        </button>
        <input
          type="range"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          onChange={(event) => applyZoom(Number(event.target.value))}
          disabled={!image}
          aria-label="Zoom"
          data-testid="crop-zoom"
        />
        <button type="button" className="icon-button" onClick={() => applyZoom(zoom + ZOOM_STEP)} disabled={!image || zoom >= MAX_ZOOM} aria-label="Zoom in">
          <ZoomIn size={18} aria-hidden="true" />
        </button>
      </div>
      <p className="cropper__hint">Drag to reposition · pinch or use the slider to zoom</p>

      <div className="cropper__actions">
        <button type="button" className="button button--ghost button--compact" onClick={centre} disabled={!image}>
          <RotateCcw size={16} aria-hidden="true" /> Reset
        </button>
        <span className="cropper__spacer" />
        <button type="button" className="button button--ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="button button--primary" onClick={handleConfirm} disabled={!image || isSaving} data-testid="crop-confirm">
          <Check size={18} aria-hidden="true" /> Use photo
        </button>
      </div>
    </div>
  );
}
