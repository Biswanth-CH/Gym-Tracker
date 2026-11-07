import { useState } from 'react';
import { Flame, ImageOff, Snowflake, Timer } from 'lucide-react';
import { getExerciseImages } from '../../constants/exerciseMedia';
import type { Stretch } from '../../types/gym';
import { ImageCredit } from '../workout/ExerciseMediaViewer';

const STYLE_LABEL = { DYNAMIC: 'Dynamic', STATIC: 'Static hold', CARDIO: 'Light cardio' } as const;

/** One warm-up / cooldown movement with its illustration(s), target, steps and dose. */
export function StretchCard({ stretch }: { stretch: Stretch }) {
  const images = getExerciseImages(stretch.media);
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  const current = images[index];
  const isWarmup = stretch.phase === 'WARMUP';

  return (
    <article className="stretch-card" data-stretch={stretch.id} data-phase={stretch.phase}>
      <div className="stretch-card__media">
        {current && !failed.has(current.url) ? (
          <img
            key={current.url}
            src={current.url}
            alt={`${stretch.name} — ${current.label.toLowerCase()}`}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            width={512}
            height={512}
            onError={() => setFailed((previous) => new Set(previous).add(current.url))}
          />
        ) : (
          <span className="stretch-card__fallback" data-testid="stretch-fallback">
            <ImageOff size={24} aria-hidden="true" />
            Image unavailable
          </span>
        )}
        {images.length > 1 && (
          <div className="segmented stretch-card__poses" role="group" aria-label={`${stretch.name} images`}>
            {images.map((image, i) => (
              <button key={image.key} type="button" className={`segmented__option${i === index ? ' is-active' : ''}`} aria-pressed={i === index} onClick={() => setIndex(i)}>
                {image.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="stretch-card__body">
        <div className="stretch-card__badges">
          <span className={`pill stretch-pill stretch-pill--${isWarmup ? 'warmup' : 'cooldown'}`}>
            {isWarmup ? <Flame size={12} aria-hidden="true" /> : <Snowflake size={12} aria-hidden="true" />}
            {isWarmup ? 'Warm-up' : 'Cooldown'} · {STYLE_LABEL[stretch.style]}
          </span>
          {stretch.optional && <span className="pill">Optional</span>}
        </div>
        <h3 className="stretch-card__name">{stretch.name}</h3>
        <p className="stretch-card__target">{stretch.target}</p>
        <p className="stretch-card__dose">
          <Timer size={14} aria-hidden="true" /> {stretch.dose}
        </p>
        <ol className="stretch-card__steps">
          {stretch.instructions.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        {current && <ImageCredit source={current.source} />}
      </div>
    </article>
  );
}

interface StretchSectionProps {
  id: string;
  title: string;
  intro: string;
  stretches: readonly Stretch[];
}

export function StretchSection({ id, title, intro, stretches }: StretchSectionProps) {
  return (
    <section className="section stretch-section" aria-labelledby={`${id}-heading`} data-testid={id}>
      <h2 id={`${id}-heading`} className="section__title">
        {title}
      </h2>
      <p className="section__meta stretch-section__intro">{intro}</p>
      <ul className="stretch-list">
        {stretches.map((stretch) => (
          <li key={stretch.id}>
            <StretchCard stretch={stretch} />
          </li>
        ))}
      </ul>
    </section>
  );
}
