import type { MemberRole, MemberStatus } from '@/types/database';

// Joriy foydalanuvchining biznesdagi o'rni.
export type Membership = {
  role: MemberRole;
  status: MemberStatus;
  business: { id: string; name: string; join_code: string };
};

// Ilovaga kirish holati: biznesi yo'q → yaratish/qo'shilish, kutmoqda → tasdiq kutish ekrani.
export type AccessState = 'loading' | 'error' | 'none' | 'pending' | 'owner' | 'seller';

export function accessState(query: {
  isPending: boolean;
  isError: boolean;
  data: Membership | null | undefined;
}): AccessState {
  // Fondagi yangilash xato bersa ham, keshdagi a'zolik bilan ishlashda davom etamiz
  // (aks holda ochiq forma butun ilova bilan birga xato ekraniga almashib ketadi).
  if (query.data === undefined) {
    return query.isError ? 'error' : 'loading';
  }
  if (query.data === null) {
    return 'none';
  }
  if (query.data.status === 'pending') {
    return 'pending';
  }
  return query.data.role;
}

// Sotuvchi faqat Flosso bo'limi va Profilni ko'radi; moliya — faqat egasiga.
export const SELLER_TABS: readonly string[] = ['flosso', 'profile'];

export function isTabVisible(tab: string, state: AccessState): boolean {
  return state === 'seller' ? SELLER_TABS.includes(tab) : true;
}
