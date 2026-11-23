import type { CardBackgroundSettings } from '../../types/gym';
import { backgroundLayerStyles } from '../../utils/cardBackground';

/**
 * The two background layers of a customised card, placed BEHIND the card content:
 *   1. the image (cover, focal point, optional blur — blur lives on this layer only),
 *   2. a dark overlay whose opacity is the dim setting.
 * Card text, badges and buttons render above both and are never blurred or dimmed.
 */
export function CardBackgroundLayers({ imageUrl, settings }: { imageUrl: string; settings: CardBackgroundSettings }) {
  const styles = backgroundLayerStyles(imageUrl, settings);
  return (
    <span className="card-bg" aria-hidden="true" data-testid="card-bg">
      <span className="card-bg__image" style={styles.image} data-testid="card-bg-image" />
      <span className="card-bg__overlay" style={styles.overlay} data-testid="card-bg-overlay" />
    </span>
  );
}
