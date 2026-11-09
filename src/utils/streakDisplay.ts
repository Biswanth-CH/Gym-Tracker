/** Every visible streak uses the same format: "5 🔥", "0 🔥". The value comes from consistencyUtils. */
export function formatStreak(streakDays: number): string {
  return `${Math.max(0, Math.floor(streakDays))} 🔥`;
}
