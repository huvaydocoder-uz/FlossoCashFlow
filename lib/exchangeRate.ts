// Markaziy bank (cbu.uz) kursi: 1 $ necha so'm. Bepul, kalitsiz, brauzerdan ham ochiq (CORS).
const pad = (value: number) => String(value).padStart(2, '0');

export function cbuRateUrl(date: Date): string {
  return `https://cbu.uz/uz/arkhiv-kursov-valyut/json/USD/${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}/`;
}

export function parseCbuRate(json: unknown): number | null {
  if (!Array.isArray(json)) {
    return null;
  }
  const row: unknown = json[0];
  if (typeof row !== 'object' || row === null || !('Rate' in row)) {
    return null;
  }
  const rate = Number((row as { Rate: unknown }).Rate);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

// Tanlangan kun kursi; internet yo'q yoki javob noto'g'ri bo'lsa — null (kurs qo'lda kiritiladi).
export async function fetchUsdRate(date: Date): Promise<number | null> {
  try {
    const response = await fetch(cbuRateUrl(date));
    if (!response.ok) {
      return null;
    }
    return parseCbuRate(await response.json());
  } catch {
    return null;
  }
}
