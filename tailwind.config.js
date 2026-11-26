// Tailwind konfiguratsiyani jiti orqali yuklaydi, shuning uchun .ts faylni
// to'g'ridan-to'g'ri require qilish mumkin. Ranglar va o'lchamlar constants/ da.
const { COLORS } = require('./constants/colors.ts');
const { SIZES } = require('./constants/sizes.ts');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: COLORS,
      borderRadius: {
        control: `${SIZES.radius.control}px`,
        card: `${SIZES.radius.card}px`,
      },
      minHeight: {
        control: `${SIZES.controlHeight}px`,
      },
    },
  },
  plugins: [],
};
