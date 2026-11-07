/**
 * Optional personal details on a profile (Phase 5): age in whole years and
 * height in centimetres. Both stay null until the user enters them — no defaults.
 * Limits match the CHECK constraints on `gym_profiles`.
 */

export const MIN_AGE_YEARS = 10;
export const MAX_AGE_YEARS = 120;
export const MIN_HEIGHT_CM = 50;
export const MAX_HEIGHT_CM = 272;

export type ParsedDetail = { ok: true; value: number | null } | { ok: false; error: string };

/** Empty input means "not provided". Ages are whole numbers. */
export function parseAgeInput(raw: string): ParsedDetail {
  const text = raw.trim();
  if (text === '') return { ok: true, value: null };
  if (!/^\d+$/.test(text)) return { ok: false, error: 'Age must be a whole number of years.' };
  const age = Number(text);
  if (age < MIN_AGE_YEARS || age > MAX_AGE_YEARS) {
    return { ok: false, error: `Age must be between ${MIN_AGE_YEARS} and ${MAX_AGE_YEARS}.` };
  }
  return { ok: true, value: age };
}

/** Accepts centimetres with up to one decimal place (a comma decimal separator is allowed). */
export function parseHeightInput(raw: string): ParsedDetail {
  const text = raw.trim().replace(',', '.');
  if (text === '') return { ok: true, value: null };
  if (!/^\d+(\.\d)?$/.test(text)) return { ok: false, error: 'Height must be a number in centimetres (one decimal at most).' };
  const height = Number(text);
  if (height < MIN_HEIGHT_CM || height > MAX_HEIGHT_CM) {
    return { ok: false, error: `Height must be between ${MIN_HEIGHT_CM} and ${MAX_HEIGHT_CM} cm.` };
  }
  return { ok: true, value: height };
}

/** Server-side style check of already-parsed values (services never trust the form). */
export function validateProfileDetails(ageYears: number | null, heightCm: number | null): string | null {
  if (ageYears !== null && (!Number.isInteger(ageYears) || ageYears < MIN_AGE_YEARS || ageYears > MAX_AGE_YEARS)) {
    return `Age must be a whole number between ${MIN_AGE_YEARS} and ${MAX_AGE_YEARS}.`;
  }
  if (heightCm !== null && (!Number.isFinite(heightCm) || heightCm < MIN_HEIGHT_CM || heightCm > MAX_HEIGHT_CM)) {
    return `Height must be between ${MIN_HEIGHT_CM} and ${MAX_HEIGHT_CM} cm.`;
  }
  return null;
}

/** Rounds to the stored precision, numeric(5, 1). */
export function normalizeHeightCm(heightCm: number | null): number | null {
  return heightCm === null ? null : Math.round(heightCm * 10) / 10;
}

export function formatHeightCm(heightCm: number): string {
  return `${Number.isInteger(heightCm) ? heightCm : heightCm.toFixed(1)} cm`;
}

/* ---------- BMI (derived, never stored) ---------- */

export interface BmiResult {
  value: number;
  category: 'Underweight' | 'Normal' | 'Overweight' | 'Obese';
}

/** Body-mass index = kg / m². Null when height or weight is missing or invalid. */
export function calculateBmi(heightCm: number | null, weightKg: number | null): BmiResult | null {
  if (heightCm === null || weightKg === null || !(heightCm > 0) || !(weightKg > 0)) return null;
  const heightM = heightCm / 100;
  const value = Math.round((weightKg / (heightM * heightM)) * 10) / 10;
  if (!Number.isFinite(value)) return null;
  const category = value < 18.5 ? 'Underweight' : value < 25 ? 'Normal' : value < 30 ? 'Overweight' : 'Obese';
  return { value, category };
}

export function formatBmi(bmi: BmiResult): string {
  return `${bmi.value.toFixed(1)} (${bmi.category})`;
}
