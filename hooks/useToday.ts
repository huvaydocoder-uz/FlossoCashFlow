import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { msUntilNextDay, startOfDay } from '@/lib/dates';

// Bugungi kun boshi (ms). Yarim tunda va ilova fondan qaytganda yangilanadi —
// ekran ochiq qolsa ham "bugun"ga bog'liq hisoblar eskirib qolmaydi.
export function useToday(): number {
  const [today, setToday] = useState(() => startOfDay(new Date()).getTime());

  useEffect(() => {
    const refresh = () => setToday(startOfDay(new Date()).getTime());
    const timer = setTimeout(refresh, msUntilNextDay(new Date()) + 1000);
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') {
        refresh();
      }
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [today]);

  return today;
}
