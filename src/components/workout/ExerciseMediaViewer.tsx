import { useEffect, useState } from 'react';
import { Film, ImageOff, Pause, Play } from 'lucide-react';
import { REPDB_ATTRIBUTION, getExerciseImages } from '../../constants/exerciseMedia';
import type { LibraryExercise } from '../../types/gym';

const POSE_INTERVAL_MS = 1100;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/**
 * Shows a licensed animation when one exists; otherwise the RepDB start/peak
 * illustrations with a pose switcher (and an optional slow alternation).
 * Broken or missing images fall back to a clear placeholder.
 */
export function ExerciseMediaViewer({ exercise }: { exercise: LibraryExercise }) {
  const images = getExerciseImages(exercise.media);
  const [poseIndex, setPoseIndex] = useState(0);
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  const [isPlaying, setIsPlaying] = useState(false);
  const [animationFailed, setAnimationFailed] = useState(false);

  useEffect(() => {
    setPoseIndex(0);
    setFailed(new Set());
    setIsPlaying(false);
    setAnimationFailed(false);
  }, [exercise.id]);

  useEffect(() => {
    if (!isPlaying || images.length < 2) return;
    const timer = window.setInterval(() => setPoseIndex((index) => (index + 1) % images.length), POSE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [isPlaying, images.length]);

  const animationUrl = exercise.media.animationUrl;
  const hasAnimation = Boolean(animationUrl) && !animationFailed;
  const current = images[poseIndex];
  const currentFailed = current ? failed.has(current.url) : true;

  return (
    <section className="media-viewer" aria-label="Exercise demonstration">
      {hasAnimation && animationUrl ? (
        <div className="media-viewer__frame">
          {animationUrl.endsWith('.mp4') ? (
            <video src={animationUrl} autoPlay={!prefersReducedMotion()} loop muted playsInline controls onError={() => setAnimationFailed(true)} />
          ) : (
            <img src={animationUrl} alt={`${exercise.name} animation`} onError={() => setAnimationFailed(true)} />
          )}
        </div>
      ) : (
        <>
          <div className="media-viewer__frame" data-testid="media-frame">
            {current && !currentFailed ? (
              <img
                key={current.url}
                src={current.url}
                alt={`${exercise.name} — ${current.label.toLowerCase()} position`}
                width={512}
                height={512}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                onError={() => setFailed((previous) => new Set(previous).add(current.url))}
              />
            ) : (
              <div className="media-viewer__fallback" data-testid="media-fallback">
                <ImageOff size={32} aria-hidden="true" />
                <span>{images.length === 0 ? 'No illustration available for this exercise yet.' : 'Image couldn’t be loaded. Check your connection.'}</span>
              </div>
            )}
          </div>

          {images.length > 1 && (
            <div className="media-viewer__controls">
              <div className="segmented" role="group" aria-label="Exercise position">
                {images.map((image, index) => (
                  <button
                    key={image.key}
                    type="button"
                    className={`segmented__option${index === poseIndex ? ' is-active' : ''}`}
                    aria-pressed={index === poseIndex}
                    onClick={() => {
                      setIsPlaying(false);
                      setPoseIndex(index);
                    }}
                  >
                    {image.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="icon-button media-viewer__play"
                onClick={() => setIsPlaying((playing) => !playing)}
                aria-pressed={isPlaying}
                aria-label={isPlaying ? 'Stop alternating poses' : 'Alternate between poses'}
              >
                {isPlaying ? <Pause size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
              </button>
            </div>
          )}
        </>
      )}

      {!hasAnimation && (
        <p className="media-viewer__notice">
          <Film size={14} aria-hidden="true" /> Animation unavailable
          {images.length > 1 ? ' — switch between the start and peak positions above.' : '.'}
        </p>
      )}
      {exercise.media.imageNote && images.length > 0 && <p className="media-viewer__note">{exercise.media.imageNote}</p>}
      {images.length > 0 && <ImageCredit source={(current ?? images[0]).source} />}
    </section>
  );
}

/** Attribution for the image currently shown (RepDB requires a visible link). */
export function ImageCredit({ source }: { source: 'repdb' | 'custom' }) {
  return (
    <p className="media-viewer__credit" data-testid="image-credit">
      Illustration:{' '}
      {source === 'repdb' ? (
        <a href={REPDB_ATTRIBUTION.url} target="_blank" rel="noopener noreferrer nofollow">
          RepDB (repdb.co)
        </a>
      ) : (
        'GymTrack original'
      )}
    </p>
  );
}
