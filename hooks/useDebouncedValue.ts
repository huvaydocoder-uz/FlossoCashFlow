import { useEffect, useState } from 'react';

// Qiymat o'zgarishini kechiktiradi (qidiruvda har bir harfga so'rov yubormaslik uchun).
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
