// Ranglar palitrasi — Flosso brendi (logotipdagi to'q qizil #720F12 va qizil #CE2127).
// Tailwind (tailwind.config.js) ham shu fayldan o'qiydi,
// shuning uchun className va JS ichidagi ranglar doim bir xil bo'ladi.
export const COLORS = {
  primary: {
    DEFAULT: '#720F12',
    pressed: '#4E0A0C',
    soft: '#F6E3E3',
  },
  accent: {
    DEFAULT: '#CE2127',
    soft: '#FBE5E6',
  },
  income: {
    DEFAULT: '#15803D',
    soft: '#DCFCE7',
  },
  expense: {
    DEFAULT: '#C81E1E',
    soft: '#FDE4E4',
  },
  warning: {
    DEFAULT: '#B45309',
    soft: '#FEF3C7',
  },
  danger: {
    DEFAULT: '#C81E1E',
    soft: '#FDE4E4',
  },
  ink: {
    DEFAULT: '#1F1717',
    muted: '#5E5151',
    subtle: '#9C8E8E',
  },
  background: '#F8F1F0',
  surface: '#FFFFFF',
  line: '#EADCDB',
  white: '#FFFFFF',
} as const;
