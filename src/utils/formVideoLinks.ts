import type { FormVideoPlatform } from '../types/gym';

/**
 * Form-reference video links (Phase 7). Pure helpers: validation, platform detection and
 * official embed URLs. Nothing here fetches or scrapes a page; previews only use each
 * platform's own public embed endpoint, and only for URLs we can parse with certainty.
 */

export const VIDEO_NAME_MAX_LENGTH = 80;
export const VIDEO_URL_MAX_LENGTH = 2048;

export const FORM_VIDEO_PLATFORMS: ReadonlyArray<{ value: FormVideoPlatform; label: string }> = [
  { value: 'YOUTUBE', label: 'YouTube' },
  { value: 'INSTAGRAM', label: 'Instagram' },
  { value: 'OTHER', label: 'Other' },
];

export function isFormVideoPlatform(value: unknown): value is FormVideoPlatform {
  return value === 'YOUTUBE' || value === 'INSTAGRAM' || value === 'OTHER';
}

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com']);
const YOUTU_BE_HOSTS = new Set(['youtu.be', 'www.youtu.be']);
const INSTAGRAM_HOSTS = new Set(['instagram.com', 'www.instagram.com', 'm.instagram.com']);
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const INSTAGRAM_CODE = /^[A-Za-z0-9_-]{5,64}$/;

export type ParsedVideoUrl =
  | { ok: true; url: string; detectedPlatform: FormVideoPlatform }
  | { ok: false; error: string };

/** Accepts only absolute http(s) URLs (no javascript:, data:, relative paths or spaces). */
export function parseVideoUrl(raw: string): ParsedVideoUrl {
  const text = raw.trim();
  if (!text) return { ok: false, error: 'Paste the video link.' };
  if (text.length > VIDEO_URL_MAX_LENGTH) return { ok: false, error: 'That link is too long.' };
  if (/\s/.test(text)) return { ok: false, error: 'A link can’t contain spaces.' };
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`);
  } catch {
    return { ok: false, error: 'That doesn’t look like a web link. It should start with https://' };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return { ok: false, error: 'Only http:// and https:// links can be saved.' };
  if (!url.hostname.includes('.')) return { ok: false, error: 'That link is missing a website address.' };
  return { ok: true, url: url.toString(), detectedPlatform: detectPlatform(url) };
}

function detectPlatform(url: URL): FormVideoPlatform {
  const host = url.hostname.toLowerCase();
  if (YOUTUBE_HOSTS.has(host) || YOUTU_BE_HOSTS.has(host)) return 'YOUTUBE';
  if (INSTAGRAM_HOSTS.has(host)) return 'INSTAGRAM';
  return 'OTHER';
}

/** Platform guess for a typed URL, or null when it can't be parsed yet. */
export function detectVideoPlatform(raw: string): FormVideoPlatform | null {
  const parsed = parseVideoUrl(raw);
  return parsed.ok ? parsed.detectedPlatform : null;
}

/** YouTube video id from watch, youtu.be, shorts, embed and live links. */
export function youtubeVideoId(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split('/').filter(Boolean);
  let candidate: string | null = null;
  if (YOUTU_BE_HOSTS.has(host)) candidate = segments[0] ?? null;
  else if (YOUTUBE_HOSTS.has(host)) {
    if (segments[0] === 'watch') candidate = url.searchParams.get('v');
    else if (['shorts', 'embed', 'live', 'v'].includes(segments[0] ?? '')) candidate = segments[1] ?? null;
  }
  return candidate && YOUTUBE_ID.test(candidate) ? candidate : null;
}

/** Instagram post / Reel / IGTV short code. */
export function instagramPost(rawUrl: string): { kind: 'p' | 'reel' | 'tv'; code: string } | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (!INSTAGRAM_HOSTS.has(url.hostname.toLowerCase())) return null;
  const segments = url.pathname.split('/').filter(Boolean);
  const kindSegment = segments[0] === 'reels' ? 'reel' : segments[0];
  if ((kindSegment === 'p' || kindSegment === 'reel' || kindSegment === 'tv') && segments[1] && INSTAGRAM_CODE.test(segments[1])) {
    return { kind: kindSegment, code: segments[1] };
  }
  return null;
}

export type VideoPreview =
  | { kind: 'youtube'; embedUrl: string; videoId: string }
  | { kind: 'instagram'; embedUrl: string }
  | { kind: 'link' };

/**
 * Official embed URL when the link is certainly a public YouTube video or Instagram post/Reel;
 * otherwise a plain link card. YouTube uses the privacy-enhanced domain and never autoplays.
 */
export function videoPreviewFor(rawUrl: string, platform: FormVideoPlatform): VideoPreview {
  if (platform === 'YOUTUBE') {
    const videoId = youtubeVideoId(rawUrl);
    if (videoId) return { kind: 'youtube', videoId, embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&autoplay=0` };
  }
  if (platform === 'INSTAGRAM') {
    const post = instagramPost(rawUrl);
    if (post) return { kind: 'instagram', embedUrl: `https://www.instagram.com/${post.kind}/${post.code}/embed/` };
  }
  return { kind: 'link' };
}

/** "youtube.com/watch?v=…" style label: host + path, without protocol or a trailing slash. */
export function readableUrl(rawUrl: string, maxLength = 48): string {
  let label = rawUrl;
  try {
    const url = new URL(rawUrl);
    label = `${url.hostname.replace(/^www\./, '')}${url.pathname === '/' ? '' : url.pathname}${url.search}`;
  } catch {
    // keep the raw text
  }
  label = label.replace(/\/$/, '');
  return label.length > maxLength ? `${label.slice(0, maxLength - 1)}…` : label;
}

export function validateVideoName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Give the video a name.';
  if (trimmed.length > VIDEO_NAME_MAX_LENGTH) return `Keep the name under ${VIDEO_NAME_MAX_LENGTH} characters.`;
  return null;
}
