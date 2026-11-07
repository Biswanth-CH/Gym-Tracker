import { useEffect, useState } from 'react';
import type { DateKey } from '../types/gym';
import { toDateKey } from '../utils/dateUtils';

/**
 * Today's local date key. Re-checks every minute and when the tab becomes
 * visible again, so an app left open past midnight rolls over correctly.
 */
export function useToday(): DateKey {
  const [todayKey, setTodayKey] = useState(() => toDateKey(new Date()));

  useEffect(() => {
    const refresh = () => setTodayKey(toDateKey(new Date()));
    const interval = window.setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  return todayKey;
}
