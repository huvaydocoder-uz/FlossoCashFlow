// Pastki menyu ikonkalari (assets/tabs/*.svg dan yasalgan PNG; logo — assets/brand/tab-logo.svg).
// Chiziqli ikonkalar qora rangda — ekranda tintColor bilan bo'yaladi.
export const TAB_ICONS = {
  home: require('../assets/tabs/home.png'),
  history: require('../assets/tabs/history.png'),
  calendar: require('../assets/tabs/calendar.png'),
  person: require('../assets/tabs/person.png'),
  // Native: 30pt (@1x/@2x/@3x) — iOS tab ikonkasini rasm o'lchamida ko'rsatadi.
  logo: require('../assets/tab-logo.png'),
  // Veb: 44px da tiniq ko'rinishi uchun katta rasm.
  logoWeb: require('../assets/tab-logo-web.png'),
} as const;
