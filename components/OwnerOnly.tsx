import { Redirect } from 'expo-router';
import type { ReactNode } from 'react';

import { useAccess } from '@/hooks/useMembership';

// Moliya ekranlari faqat biznes egasiga. Sotuvchi Flosso bo'limiga yo'naltiriladi.
export function OwnerOnly({ children }: { children: ReactNode }) {
  const access = useAccess();
  if (access === 'seller') {
    return <Redirect href="/flosso" />;
  }
  return children;
}
